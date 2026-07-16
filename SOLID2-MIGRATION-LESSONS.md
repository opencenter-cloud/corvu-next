# Solid 2.0 Migration Lessons Learned

> **Purpose:** For anyone migrating Solid 1.x libraries to Solid 2.0, documents hard-won lessons from the @corvu-next fork (20 packages migrated to `solid-js@2.0.0-beta.19`).

Last updated: 2026-07-16 (lessons #26–29 added; header updated to reflect beta.19)

---

## 1. REACTIVE_WRITE_IN_OWNED_SCOPE

**The single most dangerous migration bug.** Solid 2 introduces owned scopes — the apply phase and cleanup of `createEffect`, and component render scopes, are owned contexts where signal writes throw at runtime.

### Symptoms

- Page becomes completely non-interactive after a component lifecycle event (mount/unmount)
- Error in console: `[REACTIVE_WRITE_IN_OWNED_SCOPE] Writing to reactive state inside an owned scope (component, computation) is not allowed.`
- Once thrown, the reactive graph breaks — subsequent signal updates stop propagating
- Buttons, inputs, and navigation stop responding

### Root Cause

In Solid 1, you could freely write signals inside effects:

```typescript
// Solid 1 — worked fine
createEffect(() => {
  if (enabled()) {
    setStack((s) => [...s, id])
  }
})
```

In Solid 2's split-phase effects, the apply phase runs in an owned scope:

```typescript
// Solid 2 — THROWS at runtime
createEffect(
  () => enabled(),
  (enabled) => {
    if (enabled) {
      setStack((s) => [...s, id])  // ❌ REACTIVE_WRITE_IN_OWNED_SCOPE
    }
    return () => {
      setStack((s) => s.filter(x => x !== id))  // ❌ Also throws in cleanup
    }
  }
)
```

The same error triggers when writing a signal inside a **component render scope** — e.g., inside a children-render callback that executes during the reactive rendering tree:

```typescript
// ❌ Also throws — render callbacks are owned scopes
const resolveChildren = (childrenProps) => {
  setDialogContext(Dialog.useContext(contextId))  // signal write during render
  return children
}
```

### Fix

Use `{ ownedWrite: true }` on the **signal declaration** to allow writes from owned scopes:

```typescript
// Correct: opt the signal into owned writes
const [stack, setStack] = createSignal<string[]>([], { ownedWrite: true })

createEffect(
  () => enabled(),
  (enabled) => {
    if (enabled) {
      setStack((s) => [...s, id])  // ✅ Allowed — signal has ownedWrite
    }
    return () => {
      setStack((s) => s.filter(x => x !== id))  // ✅ Also allowed in cleanup
    }
  }
)
```

For render-time writes (e.g., grabbing a parent context during first render):

```typescript
// Correct: signal that will be written during render
const [dialogContext, setDialogContext] = createSignal<
  DialogContextValue | undefined
>(undefined, { ownedWrite: true })

const resolveChildren = (childrenProps) => {
  setDialogContext(Dialog.useContext(contextId))  // ✅ ownedWrite allows this
  return children
}
```

If you don't control the signal (e.g., from a third-party library), wrap in `queueMicrotask()` as a fallback:

```typescript
// Fallback when you can't add ownedWrite to the signal
createEffect(
  () => enabled(),
  (enabled) => {
    if (enabled) {
      queueMicrotask(() => setExternalSignal(value))
    }
    return () => {
      queueMicrotask(() => setExternalSignal(null))
    }
  }
)
```

**Prefer `ownedWrite` on the signal** — it's synchronous, type-safe, and doesn't introduce timing issues. Use `queueMicrotask` only when you can't modify the signal declaration.

### Why This Is Insidious

- **No TypeScript error** — the types don't flag it
- **No build error** — only throws at runtime
- **Timing-dependent** — may not trigger on every render; often requires a specific mount/unmount sequence (e.g., open modal → close modal → click elsewhere)
- **Programmatic tests may pass** — synthetic events can avoid the timing window that real user interactions hit
- **Cascading failure** — one throw breaks the entire reactive graph for the component tree

### Where to Look

Any signal setter called from:
- Effect apply phase or cleanup function
- Component render callbacks (children-as-function, `resolveChildren` patterns)
- Any code executing inside `<Show>`, `<For>`, or other conditional rendering during tree construction

Common patterns:
- Stack/layer management (dismissible layers, scroll lock stacks, focus trap registries)
- Global state coordination (active modals, toast queues)
- Cleanup functions that reset shared signals
- Render-time context capture (`setDialogContext(Dialog.useContext(...))`)

### The `ownedWrite` Option

`SignalOptions` exposes `ownedWrite: boolean` in Solid 2 beta.15:

```typescript
const [value, setValue] = createSignal<T>(initial, { ownedWrite: true })
```

This tells Solid: "I know this signal will be written from owned scopes — that's intentional." The write succeeds synchronously without throwing.

`EffectOptions` does **not** expose `ownedWrite` in the public types (though the runtime supports it internally). Always add it to the **signal**, not the effect.

---

## 2. STRICT_READ_UNTRACKED — Reactive Reads in Component Body

### The Rule

In Solid 2, the component body executes inside `untrack(fn, "ComponentName")` with **strict-read mode** enabled. Any reactive value read (signal, memo, or `merge()` proxy property) that is NOT inside a nested tracking scope (JSX, `createMemo`, `createEffect` compute) triggers:

```
[STRICT_READ_UNTRACKED] Reactive value read directly in <ComponentName> will not update.
```

This catches two distinct mistakes:
1. Reactive reads that the developer expects to be tracked (actual bugs)
2. Intentional one-time reads during initialization (false positives that need `untrack()`)

### Variant A: Don't Wrap useContext in createMemo

### Symptoms

- Dev-mode warning: `[STRICT_READ_UNTRACKED] Reactive value read directly in <ComponentName> will not update.`
- One warning per component instance on mount — compounds quickly (e.g., opening a popover that renders 5 sub-components produces 10 warnings)
- Component still functions but console floods with noise

### Root Cause

A common Solid 1 pattern wrapped `useContext` in `createMemo` to make the context access "reactive":

```typescript
// Solid 1 pattern — worked fine
const context = createMemo(() =>
  useInternalDialogContext(props.contextId),
)

// Then used as: context().open(), context().setOpen(...)
```

In Solid 2, the component body is **not** a tracking scope. `createMemo` evaluates its compute function eagerly during setup. When that compute function reads from the reactive context store, Solid's strict mode flags it as an untracked read — because the memo was created from an untracked parent scope.

### Fix

Call `useContext` directly — no memo needed. Context values are set once by the provider and never change:

```typescript
// Solid 2 — correct: direct context access
const context = useInternalDialogContext(props.contextId)

// Use directly: context.open(), context.setOpen(...)
```

### Why the Memo Was Unnecessary

- Context values are fixed objects containing accessor functions (getters/setters)
- The object reference never changes — only the signals *inside* it are reactive
- Those inner signals (`context.open()`, `context.contentRef()`) are read inside JSX, which IS a tracking scope — reactivity works correctly
- Wrapping in `createMemo` adds overhead and triggers warnings for zero benefit

### Scale of Impact

This pattern appeared in **30+ components** across the corvu monorepo — every Trigger, Content, Overlay, Arrow, Label, Close, Portal, and Description component. The fix is mechanical:

1. Remove `createMemo(() => ...)` wrapper
2. Access context directly as a plain variable
3. Change `context().method()` → `context.method()` throughout the file
4. Remove `createMemo` from imports if no longer used (keep it if the file has other derived computations)

### Variant B: Reading merge() Proxy Props in Component Body

#### Symptoms

- `STRICT_READ_UNTRACKED` warning fires once per component instance on mount
- Warning references the component that uses `merge()` to default props
- The read is intentional (initialization), not a tracking bug

#### Root Cause

`merge()` in Solid 2 returns a reactive proxy. Reading ANY property from a merged-props object in the component body (outside a tracking scope) triggers the warning — even if the underlying value is a static boolean or string.

```typescript
// ❌ Triggers STRICT_READ_UNTRACKED
const Component = (props) => {
  const defaultedProps = merge({ collapsible: true, disabled: false }, props)
  
  // This reads from the reactive proxy in component body:
  let initialOpen = defaultedProps.preventInitialContentAnimation && untrack(expanded)
  //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ reactive proxy read!
}
```

The proxy property access goes through a getter that Solid treats as a reactive read. Since the component body runs inside `untrack(fn, "ComponentName")`, this flags `STRICT_READ_UNTRACKED`.

#### Fix

Wrap one-time initialization reads from merged props in `untrack()`:

```typescript
// ✅ Correct: wrap the entire initialization expression in untrack
let initialOpen = untrack(() => defaultedProps.preventInitialContentAnimation && expanded())
```

Or for multiple independent reads:
```typescript
// ✅ Also correct: untrack individual reads
const initialValue = untrack(() => defaultedProps.initialValue)
```

#### Why This Is Subtle

- **Not all `defaultedProps.X` reads trigger it** — only those where the proxy detects a reactive source behind the property. Static defaults from the first arg to `merge()` (that aren't overridden by the props arg) may not trigger it.
- **Reads inside functions that aren't called immediately are safe** — e.g., `() => defaultedProps.orientation` (getter body) or callbacks only fire later.
- **Reads inside `createMemo`, `createEffect` compute, or JSX are safe** — these are tracking scopes.

#### Where to Look

Any direct `defaultedProps.X` access in the component body that:
- Seeds a `let` variable for one-time initialization
- Is passed as a non-function argument to a utility (e.g., `initialValue: defaultedProps.initialExpanded`)
- Is used in a conditional outside a tracking scope

#### Real Example (DisclosureRoot)

```typescript
// Before — triggers STRICT_READ_UNTRACKED (3× for 3 accordion items)
let initialOpen = defaultedProps.preventInitialContentAnimation && untrack(expanded)

// After — silent, same semantics
let initialOpen = untrack(() => defaultedProps.preventInitialContentAnimation && expanded())
```

The fix wraps both the prop access AND the signal read in one `untrack()` call, explicitly declaring this as a one-time initialization read that should not be tracked.

### Variant C: babel-preset-solid Extracts `ref={expr}` into Eager Component-Body Evaluation

#### Symptoms

- `STRICT_READ_UNTRACKED` warning fires once per component instance on mount
- Warning references a component that passes `ref={mergeRefs(setter, mergedProps.ref)}` in JSX
- The read appears to be inside JSX (a tracking scope), but the warning still fires

#### Root Cause

`babel-preset-solid` treats `ref` as special. When it encounters `ref={expression}` on a component, it extracts the expression into a variable evaluated **before** the `createComponent` call:

```typescript
// Source JSX:
<Polymorphic ref={mergeRefs(setRef, mergedProps.ref)} type={...} />

// babel-preset-solid output:
var _ref$ = mergeRefs(setRef, mergedProps.ref);  // ← evaluated in component body!
return _$createComponent(Polymorphic, {
  ref(r$) { _$applyRef(_ref$, r$); },
  get type() { return ...; }
});
```

The `_ref$` assignment reads `mergedProps.ref` in the component body where `strictRead` is active. Unlike `type` or `disabled` which become getters (deferred reads), `ref` is eagerly resolved because it's a callback, not a reactive value.

#### Fix

Pre-compute the ref callback in the component body and wrap the merged-props read in `untrack()`:

```typescript
// ✅ Correct: read mergedProps.ref inside untrack(), pass pre-computed callback
const refCallback = mergeRefs(setRef, untrack(() => mergedProps.ref));

return (
  <Polymorphic
    ref={refCallback}  // babel sees a simple identifier, no extraction needed
    type={isNativeButton() ? mergedProps.type : undefined}
    ...
  />
);
```

babel-preset-solid sees `ref={refCallback}` (a simple identifier) and passes it directly without extracting into `_ref$`. The `mergedProps.ref` read is wrapped in `untrack()` which sets `strictRead = false` during the read.

#### Why `untrack()` Is Safe Here

- `ref` is a callback or element reference — it does not change dynamically
- Reading it once during initialization is correct semantics
- The value is passed to `mergeRefs` which returns a new callback — reactivity is not needed

#### Scale of Impact

This pattern appears in **85 components** across Kobalte (not just 40+ as initially estimated) — every component that passes a reactive proxy property (`mergedProps.ref`, `props.ref`, `p.ref`, `merged.ref`, or `(props as Type).ref`) to `mergeRefs()` inside a `ref={...}` JSX attribute. ButtonRoot alone accounted for 148 warnings per page (one per button instance); the full set produced 155 STRICT_READ_UNTRACKED warnings on the shadcn-solid docs home page.

**Automated fix applied (commit `70a730c8`):** A codemod script (`scripts/fix-ref-strict-read.mjs`) handles all variants:
- Single-line: `ref={mergeRefs(setter, mergedProps.ref)}`
- Multi-line callbacks: `ref={mergeRefs((el) => { context.setRef(el); ref = el; }, mergedProps.ref)}`
- 3+ arguments: `ref={mergeRefs(interactOutsideRef, (el) => { ref = el; }, props.ref as any)}`
- Type-cast suffixes: `(props as CalendarGridBodyCellTriggerProps).ref as ((el: HTMLDivElement) => void) | undefined)`
- All reactive source variants: `mergedProps.ref`, `props.ref`, `p.ref`, `merged.ref`, `(props as Type).ref`
- Single-arg: `ref={mergeRefs(p.ref as any)}` (drawer-content)

The script correctly handles nested parentheses in arrow functions (does NOT treat `>` in `=>` as a bracket closer) and finds the nearest `return` statement preceding the ref usage (searching backwards from the fix position) to insert the `const refCallback` declaration.

**Result:** After applying to all 85 files and rebuilding, the shadcn-solid docs home page shows **zero** STRICT_READ_UNTRACKED warnings (verified via Chrome DevTools Protocol console message listing).

#### Where to Look

```bash
# Find all components with ref={mergeRefs(...)} pattern (before fix)
grep -rn "ref={mergeRefs" --include="*.tsx" packages/core/src/
# After the fix, this should return 0 matches
```

---

## 3. createContext Requires a Default Value

### Solid 1 Behavior

```typescript
const Ctx = createContext<T>()  // undefined default, useContext returns T | undefined
```

### Solid 2 Behavior

```typescript
const Ctx = createContext<T>()  // ❌ useContext throws ContextNotFoundError
const Ctx = createContext<T | null>(null)  // ✅ Must provide explicit default
```

### Fix

Always provide a default. Use `null` for contexts that are always provided by a parent:

```typescript
const Ctx = createContext<MyContextValue | null>(null)

// Consumer
const ctx = useContext(Ctx)
if (ctx === null) throw new Error('Missing provider')
```

---

## 4. Split-Phase Effect Migration

### Pattern

```typescript
// Solid 1
createEffect(() => {
  const el = element()
  if (!el || !enabled()) return
  
  // setup
  document.addEventListener('keydown', handler)
  
  onCleanup(() => {
    document.removeEventListener('keydown', handler)
  })
})

// Solid 2
createEffect(
  () => {
    const el = element()
    const active = enabled()
    if (!el || !active) return undefined
    return { el, active }
  },
  (next) => {
    if (!next) return
    const { el } = next
    
    // setup
    document.addEventListener('keydown', handler)
    
    // cleanup returned from apply (replaces onCleanup)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }
)
```

### Rules

1. **Compute phase** — tracked reads only, no side effects, returns a value. **Receives the previous compute result as an optional parameter** (`prev?: T`), enabling state comparison without extra signals.
2. **Apply phase** — side effects, return a cleanup function (replaces `onCleanup`). Receives `(next: T, prev?: T)`.
3. **No signal reads in apply** — apply is NOT a tracking scope; reads there won't trigger re-runs and emit `STRICT_READ_UNTRACKED`. Pass all needed values from compute via the return object.
4. **Cleanup fires before next apply** — when compute returns a new value, old cleanup runs first
5. **Return `undefined` from compute to skip apply** — null/undefined signals "nothing to do"
6. **No signal writes in apply/cleanup without `ownedWrite`** — see lesson #1
7. **Use `untrack()` in compute for comparison values** — if you need a signal's current value in apply but don't want it to trigger re-runs (e.g., comparing old vs new size), read it with `untrack()` in compute
8. **Compute receives `prev`** — the previous return value of compute is passed as the first parameter on subsequent runs. Use this to compare old vs new state without external variables:

```typescript
// Compute receives its own previous return value
createEffect(
  (prev: { show: boolean } | undefined) => {
    const show = access(props.show)
    const prevShow = prev?.show ?? show  // first run: prev is undefined
    return { prev: prevShow, show }
  },
  ({ prev, show }) => {
    if (prev === show) return  // no change
    // handle show/hide transition
  },
)
```

```typescript
// Example: reading a value for comparison without triggering re-runs
createEffect(
  () => {
    const element = contentRef()           // tracked — triggers re-run
    const present = contentPresent()       // tracked — triggers re-run
    const currentSize = untrack(() => contentSize())  // NOT tracked — just for comparison
    return { element, present, currentSize }
  },
  ({ element, currentSize }) => {
    if (!element) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    if (currentSize === null || width !== currentSize[0] || height !== currentSize[1]) {
      setContentSize([width, height])  // needs { ownedWrite: true } on the signal
    }
  },
)
```

---

## 5. API Renames

| Solid 1 | Solid 2 | Notes |
|---------|---------|-------|
| `mergeProps(defaults, props)` | `merge(defaults, props)` | Same behavior |
| `splitProps(props, ['a', 'b'])` | `omit(props, 'a', 'b')` | Returns rest only; access omitted keys via `props.a` directly |
| `onMount(() => {})` | `onSettled(() => {})` | Runs after initial render settles |
| `onCleanup(() => {})` | Return from apply phase | Inside effects; `onCleanup` still exists for component-level |
| `solid-js/web` | `@solidjs/web` | Separate package |
| `batch(() => {})` | Removed | Microtask batching is automatic |
| `import { createStore } from 'solid-js/store'` | `import { createStore } from 'solid-js'` | Store moved to main package |
| `setState('key', value)` | `setState(s => { s.key = value })` | Path API removed; draft-only (lesson #22) |
| `<Index each={...}>{(item) => item()}</Index>` | `<For each={...}>{(item) => item}</For>` | Removed; `For` handles both keyed and indexed (lesson #26) |

---

## 6. Import Path Changes

```typescript
// Solid 1
import { Portal } from 'solid-js/web'
import type { JSX, Component } from 'solid-js'

// Solid 2
import { Portal, render } from '@solidjs/web'
import type { JSX, ComponentProps, ValidComponent } from '@solidjs/web'
import { Show, For } from 'solid-js'          // unchanged — always in solid-js
import type { Component } from 'solid-js'     // unchanged — always in solid-js
```

Key moves:
- `JSX` namespace → `@solidjs/web`
- `ComponentProps` → `@solidjs/web`
- `ValidComponent` → `@solidjs/web` (includes string tag names like `'div'`)
- `Portal` → `@solidjs/web`
- `Show`, `For`, `Switch`, `Match` → remain in `solid-js`

---

## 7. Context IS the Provider

```typescript
// Solid 1
const MyContext = createContext<T>(defaultValue)
<MyContext.Provider value={...}>{children}</MyContext.Provider>

// Solid 2
const MyContext = createContext<T>(defaultValue)
<MyContext value={...}>{children}</MyContext>  // context itself is the provider component
```

---

## 8. Children Callback Props Are Values, Not Accessors

### Symptoms

- Runtime error: `"expanded is not a function"`, `"open is not a function"`, or similar
- Happens immediately when the component renders
- Component uses children-as-function pattern: `{(props) => <div>{props.expanded()}</div>}`

### Root Cause

In Solid 1, children callback props often exposed accessors (functions you call to get the current value):

```typescript
// Solid 1 pattern — children receive accessors
<Disclosure>
  {({ expanded }) => (
    <div>{expanded() ? '▼' : '▶'}</div>  // expanded is a function
  )}
</Disclosure>
```

In the Solid 2 migration, children callback props were changed to use **getter-based objects** that return plain values:

```typescript
// How the Root provides childrenProps (Solid 2):
const childrenProps = {
  get expanded() {
    return expanded()  // calls the signal, returns a boolean
  },
}
```

So `childrenProps.expanded` is already a **boolean**, not a function. Calling `expanded()` invokes a boolean as a function → crash.

### Fix

Access children callback props as values, not function calls:

```typescript
// Solid 2 — correct: props are values via getters
<Disclosure>
  {({ expanded }) => (
    <div>{expanded ? '▼' : '▶'}</div>  // expanded is a boolean
  )}
</Disclosure>
```

### How to Identify

Check the `ChildrenProps` type definition for the component. If it says `expanded: boolean` (not `expanded: Accessor<boolean>`), use it as a value.

### Reactivity Still Works

The getter-based pattern is reactive because:
- The children function runs inside a tracking scope (JSX/memo)
- Reading `props.expanded` triggers the getter, which reads the underlying signal
- Solid tracks that signal read and re-runs when it changes
- No need for `()` — the getter handles the signal access transparently

### Where This Applies

Every component with a children-as-function pattern:
- `Disclosure` — `expanded`, `contentPresent`, `collapseBehavior`
- `Dialog` — `open`, `contentPresent`, `overlayPresent`
- `Popover` — `open`, `placement`, `floatingState`
- `Drawer` — `open`, `openPercentage`, `isDragging`
- `Accordion` — `value`
- `Tooltip` — `open`

---

## 9. One-Time Registrations Don't Need Effects

### Symptoms

- Effect with no reactive reads in compute — runs once, never again
- Warnings about computations with no tracked dependencies
- Unnecessary complexity wrapping simple register/unregister in split-phase effects

### Root Cause

A common Solid 1 pattern used effects for one-time registration with cleanup:

```typescript
// Solid 1
createEffect(() => {
  context.registerTriggerId()
  onCleanup(() => context.unregisterTriggerId())
})
```

When migrating to Solid 2, developers mechanically convert this to a split-phase effect:

```typescript
// Solid 2 — WRONG: effect with no reactive dependencies
createEffect(
  () => {
    return context  // plain object, no signal reads — never re-triggers
  },
  (ctx) => {
    ctx.registerTriggerId()
    return () => ctx.unregisterTriggerId()
  },
)
```

This effect has no tracked signals in its compute, so it runs exactly once and never re-runs — it's a convoluted way to write "do on mount, undo on dispose."

### Fix

Use `onCleanup` at component level for one-time registrations:

```typescript
// Solid 2 — correct: direct call + component-level cleanup
context.registerTriggerId()
onCleanup(() => context.unregisterTriggerId())
```

Only use `createEffect` when the registration depends on a reactive value (like a ref that starts as `null`):

```typescript
// Effect justified: depends on triggerRef() which changes from null → element
createEffect(
  () => triggerRef(),
  (trigger) => {
    if (trigger) {
      context.registerTrigger(trigger)
      return () => context.unregisterTrigger(trigger)
    }
  },
)
```

### Rule of Thumb

If your effect's compute phase has **no signal reads** (or returns a static value), it's not an effect — it's initialization code. Move it to the component body.

---

## 10. Bugs Masked by Solid 1's Effect Behavior

Solid 1's synchronous effect execution masked several pre-existing bugs that surface in Solid 2:

### `prevent-scroll` — `isActive` false positive on empty stack

```typescript
// Bug: indexOf returns -1 when not found, and [].length - 1 is also -1
const isActive = (id: string) => {
  const stack = preventScrollStack()
  const index = stack.indexOf(id)
  return index === stack.length - 1  // -1 === -1 → true when stack is empty!
}

// Fix: guard against not-found
const isActive = (id: string) => {
  const stack = preventScrollStack()
  const index = stack.indexOf(id)
  return index !== -1 && index === stack.length - 1
}
```

This bug exists in upstream Corvu but was masked because Solid 1's synchronous effects meant the stack was never observed in an empty state during the critical window.

---

## 11. MISSING_EFFECT_FN — Single-Function createEffect Is Invalid

### Symptoms

- Runtime error on component mount: `[MISSING_EFFECT_FN] createEffect requires both a compute function and an effect function.`
- Component fails to render at all — throws before returning JSX
- Stack trace points to a `createEffect` call site in migrated code

### Root Cause

Solid 1 supported single-function `createEffect(() => { /* do work */ })` with implicit `onCleanup` inside. Solid 2 **requires** the split-phase form — passing only one function throws.

```typescript
// ❌ Solid 1 pattern — throws MISSING_EFFECT_FN in Solid 2
createEffect(() => {
  if (localProps.onSizesChange !== undefined) {
    localProps.onSizesChange(sizes())
  }
})

// ❌ Also throws — even for a simple side-effect notification
createEffect(() => panelData.onResize?.(panelSizeMemo()))
```

### Fix

Every `createEffect` needs two arguments: a compute function that returns a value, and an apply function that consumes it.

```typescript
// ✅ Correct — split into compute (tracked reads) + apply (side effect)
createEffect(
  () => sizes(),
  (currentSizes) => {
    localProps.onSizesChange?.(currentSizes)
  },
)

createEffect(
  () => panelSizeMemo(),
  (size) => {
    panelData.onResize?.(size)
  },
)
```

### Where to Look

Grep for `createEffect(() =>` and `createEffect((` patterns without a following `, (` — any effect that has only one function argument. These are always Solid 1 leftovers.

```bash
# Find suspicious single-function effects across a monorepo
grep -rn "createEffect(() =>" --include="*.tsx" --include="*.ts" packages/
grep -rn "createEffect((" --include="*.tsx" --include="*.ts" packages/ | grep -v "}, ("
```

---

## 12. Apply Phase Signature — `apply(next, prev?)` Not `apply(prev)`

**The single most confusing Solid 1 → Solid 2 migration trap for split-phase effects.** Getting this wrong silently breaks features that "look correct" and pass a code review.

### The Rule

Solid 2's split-phase `createEffect(compute, apply)` has this signature:

```typescript
createEffect<T>(
  compute: (prev: T | undefined) => T,
  apply: (next: T, prev: T | undefined) => (() => void) | void
)
```

- **`compute`** receives the previous compute return (its own previous output)
- **`apply`** receives `(next: T, prev: T | undefined)` — `next` is the CURRENT compute return, `prev` is the previous one

### The Trap

Solid 1's single-function `createEffect((prev) => { ... })` took `prev` as its first arg. When migrating to split-phase, it is intuitive to keep treating the apply's first parameter as `prev` and write cleanup logic against it:

```typescript
// ❌ WRONG — treats apply's `next` as previous handle → unregisters what was just registered
createEffect(
  (_prev: undefined | Handle) => {
    if (!element) return undefined
    globalHandleCallbacks = registerHandle(globalHandle)
    return globalHandle
  },
  (prevHandle) => {                    // <-- parameter named "prev" but it is `next`
    if (prevHandle) {                  // <-- always truthy after first register
      unregisterHandle(prevHandle)     // <-- undoes the registration immediately
      globalHandleCallbacks = null
    }
  },
)
```

The compute registers the handle and returns `globalHandle`. The apply is called with `next = globalHandle`, but the code names it `prevHandle` and treats it as the previous value → immediately unregisters the freshly registered handle. `globalHandleCallbacks` is set then cleared in the same microtask.

### Symptoms

- **No errors, no warnings** — everything type-checks and executes
- Feature partially works: keyboard-triggered code paths function (they call state directly), but any path that depends on state set by the effect appears "dead"
- In corvu-next this manifested as: keyboard resize worked, but mouse-drag did not — because `globalHandleCallbacks` was `null` when `onPointerDown` read it

### Fix — Use the Returned Cleanup Function

Cleanup logic belongs in the function returned from apply, not in code that inspects `prev`:

```typescript
// ✅ Correct — cleanup runs before next apply or on dispose
createEffect(
  (_prev: undefined | Handle) => {
    if (!element) return undefined
    globalHandleCallbacks = registerHandle(globalHandle)
    return globalHandle
  },
  (nextHandle) => {
    if (!nextHandle) return
    return () => {
      unregisterHandle(nextHandle)
      globalHandleCallbacks = null
    }
  },
)
```

The returned function fires:
- **Before the next apply** — when compute produces a new value
- **On dispose** — when the effect's owner is cleaned up

### Debugging Recipe

If a feature "looks correct" but state that should have been set by an effect is missing at read time, instrument both phases and see which one runs last:

```typescript
createEffect(
  (_prev) => {
    ;(window as any).__computeRuns = ((window as any).__computeRuns ?? 0) + 1
    /* compute body */
    ;(window as any).__stateSetTo = 'set'
    return value
  },
  (next) => {
    ;(window as any).__applyRuns = ((window as any).__applyRuns ?? 0) + 1
    ;(window as any).__applyFirstParam = next ? 'defined' : 'undefined'
    /* apply body */
    ;(window as any).__stateSetTo = 'null'  // if cleanup runs, this reveals it
  },
)
```

After the component mounts, inspect the flags in the browser console. If `applyFirstParam === 'defined'` on the first apply call and cleanup logic runs, the apply is treating `next` as `prev`. See lesson #14 in the Resizable Handle bug for the concrete case.

---

## 13. Signal Writes Inside `untrack()` in Compute Phase Don't Notify

**This lesson is subtle and expensive to debug.** It surfaces as "the feature renders but doesn't update" without any error or warning.

### Symptoms

- A registration function is called from an effect's compute (inside `untrack()`)
- The function writes to shared signals (e.g., `setPanels`, `setSizes`)
- Subscribers to those signals (memos in sibling components) never see the update
- The DOM reflects the initial state but never reacts to the registration
- **No errors, no warnings** — everything type-checks and runs

### Root Cause

Solid 2's `untrack(fn)` wraps `fn` in a scope that suppresses two things:
1. **Reactive reads** — reads inside are not tracked (this is the documented behavior)
2. **Write notifications from within the current compute** — writes inside `untrack()` during an effect's compute phase do not schedule dependent computations for re-execution

In Solid 1, `untrack` only suppressed reads; writes still notified subscribers immediately. In Solid 2, that combination breaks common Solid 1 patterns like:

```typescript
// ❌ Solid 1 pattern — Handle memo never re-runs after registration in Solid 2
createEffect((prev) => {
  const element = ref()
  if (!element) return undefined
  return untrack(() => {
    return context.registerPanel({ id, element, ... })  // setSizes/setPanels inside
  })
}, ...)
```

The `setPanels` inside `registerPanel` runs but the sibling Handle's `context.panels()` memo does not observe the change. Result: `panels()` returns `[]` forever, `ariaValueNow` stays `0`, and the component appears "dead."

### Fix — Move Registration Out of the Compute Phase

Do **not** call state-mutating registration from inside `untrack()` in an effect's compute. Use `onSettled` (see lesson #14) or move the reactive primitive creation out of the registration function entirely.

```typescript
// ✅ Correct — onSettled runs after render, propagates writes normally
onSettled(() => {
  const element = ref()
  if (!element) return
  const instance = context.registerPanel({ id, element, ... })
  setPanelInstance(instance)
})

onCleanup(() => {
  const instance = panelInstance()
  if (instance) context.unregisterPanel(instance.data.id)
})
```

### Where to Look

Any migrated `createEffect` that calls a `register*`/`add*`/`push*` function inside `untrack()`. The pattern was idiomatic in Solid 1 for "one-shot" side effects with reactive dependencies; in Solid 2 it silently breaks cross-component reactivity.

---

## 14. `PRIMITIVE_IN_FORBIDDEN_SCOPE` — onSettled Cannot Host Reactive Primitives

### Symptoms

- Runtime error: `[PRIMITIVE_IN_FORBIDDEN_SCOPE] Cannot create reactive primitives inside createTrackedEffect or owner-backed onSettled`
- Fires on component mount, from a helper function called inside `onSettled`
- The helper works fine when called from the component body

### Root Cause

`onSettled` runs its callback after the initial render settles, inside the component's ownership tree. It is an ideal place to run one-shot side effects that need a mounted DOM — but Solid 2 forbids creating new reactive primitives (`createMemo`, `createEffect`, `createSignal`) inside its callback.

This bites when a "registration" function creates reactive primitives internally:

```typescript
// Root.tsx — legacy registerPanel creates memo + effect inside itself
const registerPanel = (panelData: PanelData) => {
  ...
  const panelSizeMemo = createMemo(() => sizes()[sizesToIds.indexOf(panelData.id)])  // ❌
  createEffect(                                                                      // ❌
    () => panelSizeMemo(),
    (size) => panelData.onResize?.(size),
  )
  return { data: panelData, size: panelSizeMemo, ... }
}

// Panel.tsx — this throws PRIMITIVE_IN_FORBIDDEN_SCOPE
onSettled(() => {
  const instance = context.registerPanel({ ... })  // creates primitives inside onSettled
})
```

### Fix — Extract Primitive Creation to the Component Body

Refactor the registration function to be **pure** (no reactive primitives). Return plain accessors that closure over shared signals, and let each consumer create its own primitives at component-body scope:

```typescript
// Root.tsx — registerPanel returns a plain accessor built from a factory
const panelSizeMemoFactory = (id: string) => {
  return () => {
    const index = sizesToIds.indexOf(id)
    return sizes()[index]!
  }
}

const registerPanel = (panelData: PanelData): PanelInstance => {
  ...
  return {
    data: panelData,
    size: panelSizeMemoFactory(panelData.id),  // plain function, not a memo
    ...
  }
}

// Panel.tsx — Panel creates its own effect in the component body (proper ownership)
createEffect(
  () => panelInstance()?.size(),
  (size) => { if (size !== undefined) localProps.onResize?.(size) },
)
```

### Rule of Thumb

- Reactive primitives (`createMemo`, `createEffect`, `createSignal`) must be created in the **component body** or another reactive-owner scope
- `onSettled`, `onCleanup`, effect apply phases, and event handlers are all **forbidden scopes** for primitive creation
- If a helper function needs to create primitives, either inline it at the call site or refactor the helper to return plain functions/accessors

---

## 15. `createControllableSignal` Needs `ownedWrite` Support

### Context

Libraries commonly wrap `createSignal` with a helper (`createControllableSignal`) that supports both controlled and uncontrolled state. When the wrapped signal is written from an owned scope (effect apply/cleanup, or via a nested register function called from those scopes), the internal signal throws `REACTIVE_WRITE_IN_OWNED_SCOPE` (lesson #1) — even though the *outer* setter is under the caller's control.

### Fix

Add an `ownedWrite?: boolean` option to the wrapper and forward it to the internal `createSignal`:

```typescript
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  initialValue?: T
  onChange?: (value: T) => void
  ownedWrite?: boolean       // new
}): ControllableSignal<T | undefined> {
  const [uncontrolledSignal, setUncontrolledSignal] = createSignal<any>(
    props.initialValue,
    props.ownedWrite ? { ownedWrite: true } : undefined,
  )
  ...
}
```

Callers opt in when they know the signal will be written from an owned scope:

```typescript
const [sizes, setSizes] = createControllableSignal<number[]>({
  value: () => localProps.sizes,
  initialValue: [],
  onChange: localProps.onSizesChange,
  ownedWrite: true,          // Panel's registerPanel writes this from an owned scope
})
```

Do **not** default `ownedWrite: true` in the wrapper — the opt-in is what makes the guarantee auditable at each call site.

---

## 16. tsup/turbo Cache Gotcha

### Symptom

Source edits to a package appear correct in the file, but the built `dist/*.jsx` still reflects the previous version. Rebuilding "successfully" without changes to output.

### Cause

`turbo` caches build outputs based on file-content hashes but sometimes fails to invalidate when only a subset of files changes. `tsup`'s own cache in `.turbo/` can also stale.

### Fix

When a build "succeeds" but the change isn't in the output, force a clean rebuild:

```bash
cd packages/<package> && rm -rf dist .turbo && pnpm run build
```

Verify the edit made it into the built output before continuing to debug:

```bash
grep -c '<new-code-marker>' packages/<package>/dist/index.jsx
```

This is a build-infrastructure issue, not a Solid 2 issue — but it wastes hours of debugging when a "fixed" bug isn't actually being tested.

---

## 17. Signal Writes in Owned Scopes — Approach Comparison

When you need to write a signal from an effect's apply/cleanup or a render scope:

| Approach | Works | Trade-off |
|----------|-------|-----------|
| `createSignal(init, { ownedWrite: true })` | ✅ | **Best.** Synchronous, type-safe, no timing issues |
| `queueMicrotask(() => setter(...))` | ✅ | One microtask delay; context may be gone by then |
| `setTimeout(() => setter(...), 0)` | ✅ | Full task delay; may cause visual flicker |
| `untrack(() => setter(...))` | ❌ | Does NOT escape owned scope |
| Direct write (no opt-in) | ❌ | Throws REACTIVE_WRITE_IN_OWNED_SCOPE |

**Use `{ ownedWrite: true }` on the signal.** Only fall back to `queueMicrotask` if you don't control the signal declaration (e.g., third-party code).

⚠️ `queueMicrotask` has a critical limitation: **context is unavailable** after the microtask. If your deferred code calls `useContext()`, it will throw `"Context can only be accessed under a reactive root"`. This makes `queueMicrotask` unsuitable for patterns where context access is needed during render (e.g., `Dialog.useContext()` inside `resolveChildren`).

---

## 20. Signal Reads in Apply Phase via Callbacks — Replace Effect with Direct Calls

### Symptoms

- `STRICT_READ_UNTRACKED` warning fires once per Handle component on mount
- Stack trace points into a callback function called FROM the apply phase, not the apply itself
- The callback reads signals internally (e.g., `handle.startIntersection.handle()`, `handle.focused()`)

### Root Cause

An effect's apply phase calls a callback (`onHoveredChange`) that internally reads signals. Even though the signal reads are inside the callback — not literally in the apply function body — they still execute in the apply's non-tracking scope:

```typescript
// ❌ onHoveredChange reads signals like startIntersectionHandle(), focused()
createEffect(() => {
  const state = hovered()
  return state
}, (state) => {
  globalHandleCallbacks?.onHoveredChange(state)  // reads signals internally!
})
```

The `handleManager.ts` `onHoveredChange` does:
```typescript
case null: {
  const startHandle = handle.startIntersection.handle()  // ← signal read in apply scope!
  const endHandle = handle.endIntersection.handle()      // ← signal read in apply scope!
  if (!dragging && !handle.focused()) { ... }            // ← signal read in apply scope!
}
```

### Fix — Remove the Effect, Call Directly from Event Handlers

If the effect exists only to "watch" a signal and call a callback, and the signal is only set from event handlers (not other effects), remove the effect entirely. Call the callback directly after setting the signal:

```typescript
// ✅ Correct — no effect needed, call directly from handlers
const setHoveredAndNotify = (state: HoverState) => {
  setHovered(state)
  globalHandleCallbacks?.onHoveredChange(state)
}

const onMouseEnter = (e) => {
  if (callEventHandler(localProps.onMouseEnter, e) || localProps.disabled === true) return
  setHoveredAndNotify('handle')
}
const onMouseLeave = (e) => {
  if (callEventHandler(localProps.onMouseLeave, e)) return
  setHoveredAndNotify(null)
}
```

Event handlers are NOT tracking scopes either, but they're not **owned** scopes — signal reads in event handlers don't warn because Solid doesn't enforce strict-read in event handlers the way it does in effect callbacks.

### When to Apply This Pattern

- The effect's compute reads exactly ONE signal and passes it to apply
- That signal is only ever set from event handlers (mouse, keyboard, focus)
- The apply calls a function that reads other signals internally
- The effect adds no value — it's just forwarding from `setX` → callback

### Rule of Thumb

If an effect's only job is `signal → callback`, and the signal setter is always called from event handlers, inline the callback next to the setter. The effect was a Solid 1 pattern for "watching" — in Solid 2 it introduces unnecessary scoping constraints.

---

## 21. pnpm Lockfile Phantom Versions After `--latest` Rollback

### Symptoms

- Type errors reference APIs that DON'T EXIST in the version declared in `package.json`
- `ValidComponent` or `JSX` reported as "declared locally but not exported" from `@solidjs/web`
- `package.json` says `2.0.0-beta.15` but the actual resolved types come from `2.0.0-experimental.0`
- `pnpm install` reports the correct version but errors persist

### Root Cause

`pnpm update --latest` resolves a newer version (e.g., `@solidjs/web@2.0.0-experimental.0`) and writes it to `pnpm-lock.yaml`. When you later pin the version back in `package.json` (e.g., `"@solidjs/web": "2.0.0-beta.15"`), running `pnpm install`:

1. Checks if the lockfile resolution satisfies the new constraint
2. May consider it "already satisfied" or partially update
3. Leaves the `.pnpm` store entry pointing at the old (wrong) version

Result: TypeScript resolves types from the **phantom version** in the store, not the one declared in `package.json`.

### Detection

```bash
# Check what's actually in the store
find node_modules/.pnpm -maxdepth 1 -name "@solidjs+web*"
# Bad:  @solidjs+web@2.0.0-experimental.0_solid-js@2.0.0-beta.15
# Good: @solidjs+web@2.0.0-beta.15_solid-js@2.0.0-beta.15

# Or use TypeScript's own resolution
node -e "
const ts = require('typescript');
const opts = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext };
const host = ts.createCompilerHost(opts);
const r = ts.resolveModuleName('@solidjs/web', process.cwd() + '/src/test.ts', opts, host);
console.log(r.resolvedModule?.resolvedFileName);
"
```

### Fix

Delete the lockfile and `node_modules`, then reinstall from scratch:

```bash
rm -rf node_modules pnpm-lock.yaml && pnpm install
```

A plain `pnpm install` after editing `package.json` is NOT sufficient when rolling back from `--latest`.

### Why This Matters for Solid 2

`@solidjs/web@2.0.0-experimental.0` restructured its type exports — `ValidComponent`, `JSX`, and `ComponentProps` are imported from `solid-js` rather than declared locally. TypeScript sees them as "declared but not exported" when resolving through the experimental version's types. The beta.15 version exports them directly.

This produced **379 phantom type errors** that looked like a TypeScript 6 incompatibility but were actually a stale lockfile resolution.

### Rule of Thumb

After ANY `pnpm update --latest` that you partially roll back, always:
```bash
rm -rf node_modules pnpm-lock.yaml && pnpm install
```

Never trust `pnpm install` alone to downgrade a previously-resolved version.

---

## 22. `createStore` setState Is Draft-Based — No Path API

### Symptoms

- TypeScript error: `Expected 1 arguments, but got 2` on `setState('key', value)` or `setState('nested', fn)`
- Occurs in any code using `createStore` from Solid 1 that relied on the path-based setter

### Root Cause

Solid 1's `createStore` returned a setter with multiple overloads:

```typescript
// Solid 1 — path-based setState (multiple forms)
setState('value', 'new string')
setState('filtered', { count, items, groups })
setState('ids', (ids) => ({ ...ids, [id]: { value, keywords } }))
setState('groups', (groups) => ({ [id]: [], ...groups }))
setState((state) => ({ ...state, items: [...state.items, id] }))  // also worked
```

In Solid 2, `StoreSetter<T>` is a single form:

```typescript
type StoreSetter<T> = (fn: (state: T) => T | void) => void
```

**Only the draft-callback form exists.** Path-based setters, keyed setters, and `produce`-style updates are replaced by direct mutation of the draft:

```typescript
// Solid 2 — draft-based setState (only form)
setState(s => { s.value = 'new string' })
setState(s => { s.filtered = { count, items, groups } })
setState(s => { s.ids = { ...s.ids, [id]: { value, keywords } } })
setState(s => { s.groups = { [id]: [], ...s.groups } })
setState(s => { s.items = [...s.items, id] })
```

### Migration Rules

| Solid 1 | Solid 2 |
|---------|---------|
| `setState('key', value)` | `setState(s => { s.key = value })` |
| `setState('key', (prev) => transform(prev))` | `setState(s => { s.key = transform(s.key) })` |
| `setState((s) => ({ ...s, key: value }))` | `setState(s => { s.key = value })` (mutate in place) |
| `setState('nested', 'deep', value)` | `setState(s => { s.nested.deep = value })` |
| `produce(s => { s.key = v })` | Already the correct form — remove `produce` wrapper |

### Mutation vs Return

The draft callback can either:
1. **Mutate in place** (canonical): `setState(s => { s.list.push(x) })`
2. **Return a new value** (for awkward shapes): `setState(s => ({ ...s, list: s.list.filter(fn) }))`

Arrays are replaced by index (length adjusted); objects are shallow-diffed at the top level (keys present in the returned value are written, missing keys deleted).

### Impact

This affects every `createStore` usage site. In the cmdk-solid migration alone, 10 setState calls required rewriting. The change is mechanical but must be applied to ALL stores — `pnpm patch` files, workspace packages, and registry source files.

### Where to Look

```bash
# Find all path-based setState patterns
grep -rn "setState('" --include="*.ts" --include="*.tsx" packages/
grep -rn "setState(\"" --include="*.ts" --include="*.tsx" packages/
```

---

## 23. `babel-preset-solid` Version Mismatch — `solid-js/web` in Compiled Output

### Symptoms

- Built ESM output imports from `'solid-js/web'` (template, insert, spread, createComponent, etc.)
- `solid-js/web` does NOT exist in Solid 2 — module resolution fails at runtime
- The source code correctly imports from `'solid-js'` and `'@solidjs/web'` — the problem is in JSX compilation

### Root Cause

`tsup-preset-solid` depends on `esbuild-plugin-solid`, which depends on `babel-preset-solid@^1.6.9`. pnpm resolves this to `babel-preset-solid@1.9.12` — the latest Solid 1 version. This babel preset compiles JSX `<div>` into runtime calls that import from `'solid-js/web'`.

In Solid 2, the correct babel preset (`babel-preset-solid@2.0.0-beta.15`) compiles JSX to import from `'@solidjs/web'`.

### Detection

After building a Solid 2 package:

```bash
grep "solid-js/web" dist/index.js
# If any hits → wrong babel preset is being used

grep "@solidjs/web" dist/index.js
# Should have at least one hit (the JSX runtime import)
```

### Fix

Add `babel-preset-solid` to pnpm overrides in the **root** `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "babel-preset-solid": "2.0.0-beta.15"
    }
  }
}
```

This forces ALL transitive resolutions (including `esbuild-plugin-solid`'s dependency) to use the Solid 2 version. The override must be in the **workspace root** `package.json` to apply globally.

### Verification

After adding the override:

```bash
pnpm install
find node_modules -path "*esbuild-plugin-solid*/node_modules/babel-preset-solid/package.json" \
  -exec grep '"version"' {} \;
# Should show: "version": "2.0.0-beta.15"
```

Then rebuild the package and confirm `@solidjs/web` in output:

```bash
cd packages/<package> && rm -rf dist && pnpm build
grep "from '@solidjs/web'" dist/index.js  # should match
grep "from 'solid-js/web'" dist/index.js  # should NOT match
```

### Why This Matters

- `solid-js/web` is not a valid import path in Solid 2 — there is no subpath export for it
- The compiled JSX runtime helpers (template, insert, spread, effect, memo, createComponent) MUST come from `@solidjs/web`
- Without the override, a workspace package will build "successfully" (no type errors, no bundler errors) but fail at runtime with `ERR_PACKAGE_PATH_NOT_EXPORTED` or similar resolution errors

### Scope

Affects any Solid 2 workspace package using `tsup-preset-solid` or `esbuild-plugin-solid` for compilation. Does NOT affect packages built with `vite-plugin-solid@3.0.0-next.5` (which bundles its own copy of the correct babel preset).

---

## 24. `merge()` Import Collides with Local Variable Name

### Symptoms

- After mechanically renaming `mergeProps` → `merge` in imports, code that assigned the result to a local variable named `merge` shadows the imported function:

```typescript
// ❌ Name collision — local `merge` shadows imported `merge`
import { merge } from "solid-js"

const merge = merge({ showCloseButton: true }, props)  // ReferenceError or infinite recursion
```

### Root Cause

A widespread Solid 1 pattern in shadcn-solid and similar libraries:

```typescript
import { mergeProps, splitProps } from "solid-js"

const merge = mergeProps({ showCloseButton: true }, props)
const [, rest] = splitProps(merge, ["class", "children", "showCloseButton"])
// Then: merge.class, merge.children, etc.
```

When `mergeProps` becomes `merge`, the local variable declaration `const merge = merge(...)` is self-referential. Even if it doesn't error at parse time, subsequent `merge.prop` reads now reference the local object — which works — but the next component that does `merge(defaults, props)` without a local assignment will fail if the import was accidentally removed during cleanup.

### Fix

Rename the **local variable** to avoid shadowing. Use a consistent name like `mergedProps`:

```typescript
import { merge, omit } from "solid-js"

const mergedProps = merge({ showCloseButton: true }, props)
const rest = omit(mergedProps, "class", "children", "showCloseButton")
// Access: mergedProps.class, mergedProps.children, props.showCloseButton
```

### Codemod Strategy

When automating `mergeProps` → `merge`:

1. Rename the import specifier: `mergeProps` → `merge`
2. Rename all `mergeProps(` call sites → `merge(`
3. **Detect** `const merge = merge(` pattern (local assignment)
4. Rename the local binding: `const merge` → `const mergedProps`
5. Rename all property accesses on the old local: `merge.X` → `mergedProps.X`
6. Rename the variable when passed to other functions: `splitProps(merge,` → `omit(mergedProps,`

Step 5 requires care: don't rename `merge(` (function call) to `mergedProps(`. Only rename `.property` accesses and identifier references that aren't immediately followed by `(`.

### Scale

In the shadcn-solid registry, 16 files used `mergeProps`, and **all 16** used the `const merge = mergeProps(...)` pattern. This is the dominant idiom in component libraries that use Kobalte's polymorphic props pattern.

---

## 25. Virtual Module Compat Plugin — Better Than Per-File Patches

### Symptoms

- Build errors like `"mergeProps" is not exported by "solid-js"` from third-party deps
- Errors appear from files NOT covered by your `pnpm patch` (different entry points Vite resolves)
- Patching `build/lib/index.esm.js` doesn't help because the `exports` field points to `build/lib/index.mjs` or `dist/source/*.jsx`
- Each fix reveals another unpatched entry point — whack-a-mole

### Root Cause

Third-party packages often ship multiple entry points (`src/`, `build/lib/`, `dist/source/`). The `pnpm patch` mechanism generates a diff against ONE set of files, but Vite/Rollup resolves different files depending on:
- Export conditions (`"solid"`, `"import"`, `"browser"`)
- Whether SSR or client build
- Whether `resolve.conditions` is set

Result: patching `build/lib/index.esm.js` doesn't help when Vite resolves `dist/source/createField.jsx` via the `"solid"` condition. You'd need to patch EVERY output variant — impractical.

### Fix — Vite Plugin with `resolveId` + `load`

Create a Vite plugin that intercepts `solid-js` imports **from node_modules** at the resolution level and returns a virtual module that re-exports all Solid 2 APIs plus aliases for removed names:

```typescript
import type { Plugin } from "vite"

export default function solidCompat(): Plugin {
  const VIRTUAL_ID = "\0solid-compat"

  return {
    name: "solid-compat",
    enforce: "pre",
    resolveId(source, importer) {
      // Only intercept imports from third-party code
      if (source === "solid-js" && importer?.includes("node_modules")) {
        return VIRTUAL_ID
      }
      if (source === "solid-js/web" && importer?.includes("node_modules")) {
        return this.resolve("@solidjs/web", importer, { skipSelf: true })
      }
      if (source === "solid-js/store" && importer?.includes("node_modules")) {
        return VIRTUAL_ID  // store APIs merged into solid-js in Solid 2
      }
      return null
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return `
export * from "solid-js";
export { merge as mergeProps } from "solid-js";
export { omit as splitProps } from "solid-js";
export { onSettled as onMount } from "solid-js";
export { createEffect as createComputed } from "solid-js";
`
      }
      return null
    },
  }
}
```

### Why This Works

- `resolveId` fires BEFORE Rollup validates named exports — it intercepts the entire module specifier
- The virtual module re-exports everything from `solid-js` (so `createSignal`, `createEffect`, etc. still work) plus adds aliases for the old names
- Only applies to `node_modules` — your own migrated source code uses the real `solid-js` directly
- Handles `solid-js/web` → `@solidjs/web` and `solid-js/store` → `solid-js` as module-level redirects
- Works for both client and SSR builds without separate patches

### When to Use This vs pnpm Patch

| Situation | Approach |
|-----------|----------|
| Package has 1–2 files, simple renames | `pnpm patch` is simpler |
| Package has multiple entry points, or Vite resolves unexpected files | Virtual module plugin |
| Many deps have the same problem (solid-table, solid-form, solid-store, primitives/deep) | Plugin handles ALL of them with zero per-package config |
| Package needs structural changes (split-phase effects, Context.Provider removal) | `pnpm patch` for structural, plugin for naming |

### Limitations

- Only handles **renames** and **re-exports**. Cannot fix structural issues like single-function `createEffect` → split-phase, or `<Context.Provider>` → `<Context>`.
- `createComputed → createEffect` alias is a **behavioral approximation** — `createComputed` in Solid 1 ran synchronously and didn't require a return value. The effect in Solid 2 requires split-phase. This alias works for simple "watch and react" patterns but not for effects that depend on synchronous execution order.
- If a dep uses `splitProps` and destructures the tuple result (`const [local, rest] = splitProps(...)`), the alias to `omit` will break (different return type). Those deps still need patching.

### Real-World Impact

In the shadcn-solid docs build, this single plugin replaced the need to patch 4+ packages (`@tanstack/solid-table`, `@tanstack/solid-form`, `@tanstack/solid-store`, `@solid-primitives/deep`) across 12+ entry point files. Build went from failing with whack-a-mole errors to passing on first try after the plugin was added.

---

## 18. Debugging Strategy

### Symptoms → Likely Cause

| Symptom | Check |
|---------|-------|
| Page freezes after component unmount | `REACTIVE_WRITE_IN_OWNED_SCOPE` in console |
| Page freezes after switching views | Same — signal write during `<Show>` tree construction |
| Component throws `MISSING_EFFECT_FN` on mount | Single-function `createEffect` — convert to split-phase (lesson #11) |
| Feature partially works: keyboard OK but mouse drag dead | Apply phase treated as `prev` instead of `next` — cleanup runs immediately (lesson #12) |
| Sibling component's memo never re-runs after registration | Signal write inside `untrack()` in effect compute — move to `onSettled` (lesson #13) |
| `PRIMITIVE_IN_FORBIDDEN_SCOPE` on component mount | Reactive primitive created inside `onSettled`/effect apply/cleanup — refactor to component body (lesson #14) |
| "x is not a function" on render | Children callback treats getter-props as accessors — use `prop` not `prop()` (lesson #8) |
| "ContextNotFoundError" | `createContext()` missing default value |
| "Context can only be accessed under a reactive root" | `useContext` called from `queueMicrotask` or async code |
| `STRICT_READ_UNTRACKED` warning | `createMemo(() => useContext(...))` — remove the memo (lesson #2A) |
| `STRICT_READ_UNTRACKED` on component mount | `merge()` proxy prop read in component body — wrap in `untrack()` (lesson #2B); or `ref={mergeRefs(..., mergedProps.ref)}` extracted eagerly by babel — pre-compute with `untrack()` (lesson #2C) |
| `STRICT_READ_UNTRACKED` in effect callback | Signal read in apply phase — move to compute and pass via return value (lesson #4), or if effect only watches+forwards, replace with direct call from event handler (lesson #20) |
| Effect fires but no cleanup | Missing return from apply phase |
| Cleanup runs immediately | Compute returning a new object reference every time (use primitives or `===` check) |
| Effect never fires | Compute not reading any tracked signals |
| Source edit "successful build" but bug persists | Turbo/tsup cache stale — `rm -rf dist .turbo && pnpm run build` (lesson #16) |
| Hundreds of "not exported" errors after rolling back a dep version | Phantom version in pnpm lockfile — `rm -rf node_modules pnpm-lock.yaml && pnpm install` (lesson #21) |
| TS error "Expected 1 arguments, but got 2" on `setState` | `createStore` path-based API removed — use draft form `setState(s => { s.key = v })` (lesson #22) |
| Built output imports from `'solid-js/web'` (nonexistent) | Wrong `babel-preset-solid` — add pnpm override to force `2.0.0-beta.15` (lesson #23) |
| Build error: `"X" is not exported by "solid-js"` from node_modules | Third-party dep uses old API names — use virtual-module compat plugin instead of per-file patch (lesson #25) |
| Vite error: `does not provide an export named 'Index'` | `<Index>` removed in Solid 2 — replace with `<For>`, change `item()` → `item` (lesson #26) |
| TypeError: `Cannot read properties of undefined (reading '$$mousemove')` | Event delegation crash on stale node — use `on:mousemove` instead of `onMouseMove` (lesson #27) |
| `STRICT_READ_UNTRACKED` on props read during initialization | One-time read from reactive prop proxy in component body — wrap in `untrack()` (lesson #28) |
| Astro SSR crash: `Suspense is not exported` or `reconcile` import error | Fork `@astrojs/solid-js` with Solid 2 paths: `Loading` instead of `Suspense`, `@solidjs/web` instead of `solid-js/web` (lesson #29) |

### Tooling

- `vite-plugin-pilot` — inject into dev app, query DOM state and body styles remotely via file bridge
- Console errors are terminal in Solid 2 — one `REACTIVE_WRITE_IN_OWNED_SCOPE` breaks the entire tree
- Check `document.body.style.cssText` and `getComputedStyle(document.body).pointerEvents` when debugging "page not interactive"
- Test all tab/view transitions, not just in-component interactions — `<Show>` disposal + creation paths trigger different code paths than same-component state changes

---

## 19. Migration Checklist

For each file being migrated:

- [ ] Replace `mergeProps` → `merge`
- [ ] Rename local variables `const merge = merge(...)` → `const mergedProps = merge(...)` to avoid shadowing the imported function (lesson #24)
- [ ] Replace `splitProps` → `omit` (adjust access pattern)
- [ ] Replace `solid-js/web` imports → `@solidjs/web`
- [ ] Move JSX types to `@solidjs/web`
- [ ] Convert `createEffect` to split-phase (compute + apply) — **no single-function form** (lesson #11)
- [ ] For split-phase effects, treat apply's first param as **`next` (current)**, not `prev` — cleanup goes in the returned function (lesson #12)
- [ ] Replace `onCleanup` inside effects with return-from-apply
- [ ] Add explicit default to all `createContext()` calls
- [ ] Replace `<Context.Provider>` with `<Context value={...}>`
- [ ] Remove `createMemo` wrappers around `useContext` calls — access context directly
- [ ] Wrap one-time initialization reads from `merge()` proxy in `untrack()` (lesson #2B)
- [ ] Pre-compute `ref={mergeRefs(setter, mergedProps.ref)}` into a const with `untrack()` around the proxy read (lesson #2C) — use `scripts/fix-ref-strict-read.mjs` codemod for bulk application
- [ ] Do NOT call state-mutating registration inside `untrack()` in an effect compute — use `onSettled` (lesson #13)
- [ ] Registration helpers must not create reactive primitives if called from `onSettled`/apply/cleanup — refactor to return plain accessors (lesson #14)
- [ ] Forward an `ownedWrite` option through wrapper primitives (e.g., `createControllableSignal`) when downstream writes come from owned scopes (lesson #15)
- [ ] Update children-as-function consumers: use `prop` not `prop()` for getter-based childrenProps
- [ ] Audit all signal writes in apply/cleanup/render → add `{ ownedWrite: true }` to those signals
- [ ] Convert one-time register/unregister effects to direct calls + `onCleanup` (lesson #9)
- [ ] Replace "watch signal → call callback" effects with direct callback calls from event handlers when the signal is only set from handlers (lesson #20)
- [ ] After edits, verify built output contains your change (`grep -c '<marker>' dist/index.jsx`) — clean `rm -rf dist .turbo` if stale (lesson #16)
- [ ] Rewrite all `setState('key', value)` to draft form `setState(s => { s.key = value })` — path-based API removed (lesson #22)
- [ ] Verify built output imports from `'@solidjs/web'` NOT `'solid-js/web'` — add babel-preset-solid override if wrong (lesson #23)
- [ ] For apps consuming multiple third-party Solid 1 deps: add a virtual-module compat plugin rather than patching each dep individually (lesson #25)
- [ ] Replace all `<Index>` with `<For>` and remove accessor calls (`item()` → `item`) (lesson #26)
- [ ] Use `on:mousemove` (native) instead of `onMouseMove` (delegated) on items inside dynamic lists that re-render frequently (lesson #27)
- [ ] Wrap one-time initialization reads from props (arrays, objects) in `untrack()` when the component doesn't need to react to prop changes (lesson #28)
- [ ] For Astro projects: fork `@astrojs/solid-js` with Solid 2 imports (`Loading`, `@solidjs/web`, draft-based store), add SSR error guards for browser-only components (lesson #29)
- [ ] Test: open/close cycles, mount/unmount sequences, rapid state changes
- [ ] Test: switching between views/tabs that mount/unmount the component
- [ ] Test: real user interaction paths (drag, hover, focus) — synthetic events may not exercise Solid's event delegation
- [ ] Verify no `REACTIVE_WRITE_IN_OWNED_SCOPE` errors in console
- [ ] Verify no `MISSING_EFFECT_FN` errors in console
- [ ] Verify no `PRIMITIVE_IN_FORBIDDEN_SCOPE` errors in console
- [ ] Verify no `STRICT_READ_UNTRACKED` warnings (context memos #2A, merge proxy reads #2B, apply-phase reads #4)

---

## Packages Affected by These Lessons

| Package | Lessons Applied |
|---------|----------------|
| `@corvu-next/dismissible` | #1 (owned-scope write), #3 (context default), #4 (split-phase) |
| `@corvu-next/prevent-scroll` | #1 (owned-scope write), #10 (masked bug), #4 (split-phase) |
| `@corvu-next/focus-trap` | #1 (owned-scope write), #4 (split-phase) |
| `@corvu-next/popover` | #1 (render-time write), #2A (Trigger, Content, Arrow, Anchor) |
| `@corvu-next/drawer` | #1 (render-time write), #2A (Content, Overlay) |
| `@corvu-next/dialog` | #2A (Trigger, Content, Close, Portal, Overlay, Label, Description) |
| `@corvu-next/tooltip` | #2A (Trigger, Content, Arrow, Anchor, Portal) |
| `@corvu-next/accordion` | #1 (owned-scope write), #2A (Trigger, Content, Item), #4 (signal reads in apply), #8 (children callback), #9 (one-time registration) |
| `@corvu-next/disclosure` | #1 (owned-scope write), #2A (Trigger, Content), #2B (initialOpen prop read), #4 (signal reads in apply), #8 (children callback) |
| `@corvu-next/calendar` | #2A (Nav, Label, CellTrigger, Table) |
| `@corvu-next/otp-field` | #2A (Input) |
| `@corvu-next/resizable` | #2A (Handle, Panel), #11 (MISSING_EFFECT_FN in Root), #12 (Handle apply signature), #13 (registerPanel in untrack), #14 (PRIMITIVE_IN_FORBIDDEN_SCOPE via onSettled), #15 (createControllableSignal ownedWrite), #20 (Handle hovered effect → direct call) |
| `@corvu-next/presence` | #4 (split-phase), #5 (renames) |
| `@corvu-next/utils` | #5 (renames), #6 (imports) |
| All packages | #5 (renames), #6 (imports), #7 (context-as-provider) |
| `@opencenter-cloud/kobalte-core` (85 components) | #2C (ref extraction via babel-preset-solid — all 85 ref={mergeRefs} patterns fixed) |
| `@opencenter-cloud/cmdk-solid` | #1 (ownedWrite), #3 (context default), #4 (split-phase ×7), #5 (renames), #6 (imports), #7 (context-as-provider), #9 (one-time registration), #22 (store draft API), #23 (babel-preset override) |
| `embla-carousel-solid` (patch) | #1 (ownedWrite), #4 (split-phase ×3), #5 (renames) |
| `@tanstack/solid-table` (patch) | #4 (split-phase), #5 (renames), #22 (createStore import move) |
| `@tanstack/solid-form` (patch) | #4 (split-phase ×4), #5 (renames ×7), #6 (imports), #7 (context-as-provider) |
| shadcn-solid registry (54 files) | #5 (renames ×45+16), #6 (imports ×44), #7 (context-as-provider ×4), #9 (direct registration ×2), #24 (merge naming ×16) |
| shadcn-solid docs app | #5 (renames), #6 (imports ×19), #22 (store draft), #23 (babel-preset), #25 (solid-compat plugin for 4+ deps) |
| `@corvu-next/web` (docs site) | #26 (Index removal), #27 (event delegation), #28 (props in component body) |
| `@corvu-next/astrojs-solid-next` | #29 (Astro SSR integration: Loading, @solidjs/web, draft store, SSR guards) |

---

## 26. `Index` Component Removed — Use `For` Instead

### Symptoms

- Vite error: `The requested module 'solid-js' does not provide an export named 'Index'`
- Build failure on any file importing `Index` from `solid-js`

### Root Cause

Solid 1 had two list components:
- `<For each={...}>` — keyed by reference (callback receives the item directly)
- `<Index each={...}>` — keyed by index (callback receives an accessor `() => item`)

In Solid 2, `<Index>` was removed. `<For>` handles both use cases.

### Fix

Replace `<Index>` with `<For>` and change accessor calls to direct value access:

```typescript
// Solid 1 — Index gives accessors
import { Index } from 'solid-js'
<Index each={items()}>
  {(item) => <div>{item()}</div>}    // item is an accessor
</Index>

// Solid 2 — For gives values directly
import { For } from 'solid-js'
<For each={items()}>
  {(item) => <div>{item}</div>}      // item is the value
</For>
```

### Migration Pattern

1. Replace `import { Index }` → `import { For }` (or add `For` if already importing it)
2. Replace `<Index` → `<For` and `</Index>` → `</For>`
3. Remove `()` from every callback parameter usage: `item()` → `item`, `day()` → `day`, `week()` → `week`

### Where to Look

```bash
grep -rn "Index" --include="*.tsx" --include="*.ts" src/ | grep "from 'solid-js'"
```

### Scale

In the corvu-next docs site, 5 calendar example files used `Index`. The fix is mechanical.

---

## 27. Event Delegation Crash on Stale Nodes — Use `on:event` for Dynamic Lists

### Symptoms

- Uncaught TypeError: `Cannot read properties of undefined (reading '$$mousemove')` (or `$$click`, `$$input`, etc.)
- Fires when mouse moves over a list item that is being re-rendered
- Stack trace shows `handleNode` → `walkUpTree` → `eventHandler` in `@solidjs/web`

### Root Cause

Solid 2 uses event delegation — it registers one handler on `document` (or `body`) for common events (`click`, `input`, `mousemove`, etc.) and walks up the DOM from `event.target` looking for `$$eventname` properties on each node. When a reactive list re-renders (e.g., search results changing), DOM nodes are removed while the event is bubbling. The walk-up encounters a node that's already been cleaned up (no `$$mousemove` property) → crash.

This is a timing issue specific to delegated events on dynamically-rendered lists where:
1. The list re-renders frequently (e.g., on every keystroke)
2. The event fires on an item being removed (mouse still over it during re-render)

### Fix

Use **native event binding** (`on:eventname`) instead of the delegated form (`onEventName`):

```typescript
// ❌ Delegated — crashes when item is removed during re-render
<a onMouseMove={() => setActive(index)}>

// ✅ Native binding — handler is on the element directly, no delegation
<a on:mousemove={() => setActive(index)}>
```

Native bindings (`on:`) attach the handler directly to the DOM element. When the element is removed, its handler goes with it — no stale-node walk-up.

### When to Use `on:` vs `on*`

| Situation | Use |
|-----------|-----|
| Static elements (buttons, inputs, nav links) | `onClick`, `onInput` — delegation is fine |
| Items inside `<For>` or `<Show>` that re-render frequently | `on:click`, `on:mousemove` — avoid delegation race |
| Events that fire continuously (mousemove, scroll, pointermove) | `on:` — also avoids delegation overhead |
| Events on elements that may be removed during the event | `on:` — prevents stale-node crash |

### Performance Note

`on:` binds per-element, so in a list of 1000 items you get 1000 handlers (vs 1 delegated handler). For small lists (<100 items) or infrequent events, this is negligible. For large lists with `mousemove`, consider debouncing or using delegation on a stable parent container.

---

## 28. `untrack()` Props in Component Body — STRICT_READ_UNTRACKED for One-Time Init

### Symptoms

- `[STRICT_READ_UNTRACKED] Reactive value read directly in <ComponentName> will not update.`
- Warning fires on component mount
- The read is from `props.someArray` or `props.someObject` during one-time initialization (building a data structure, iterating, filtering)

### Root Cause

Component props in Solid 2 are reactive proxies (via `merge()` or direct prop access). Reading from them in the component body (which runs in `untrack()` with strict-read mode) triggers the warning — even when the read is intentionally one-time (e.g., building a static lookup table from props that never change after mount).

```typescript
// ❌ Triggers STRICT_READ_UNTRACKED
const TableOfContents = (props: { headings: Heading[] }) => {
  const toc: Heading[] = []
  props.headings.forEach((h) => {   // reactive proxy read in component body
    toc.push(h)
  })
}
```

### Fix

Wrap the entire one-time initialization block in `untrack()`:

```typescript
// ✅ Correct — explicit untrack for one-time initialization
const TableOfContents = (props: { headings: Heading[] }) => {
  const toc: Heading[] = []
  untrack(() => {
    props.headings.forEach((h) => {
      toc.push(h)
    })
  })
}
```

### When to Apply

- Props are static arrays/objects passed from Astro/server (never change client-side)
- You're building a derived data structure during initialization (maps, trees, lookups)
- The component doesn't need to react to prop changes (SSR'd content, configuration)

### When NOT to Apply

- Props that genuinely change at runtime — use `createMemo` or read inside JSX instead
- Props read inside `<For each={props.items}>` — already in a tracking scope
- Props read inside `createEffect` compute — already tracked

### Relationship to Lesson #2B

This is the same underlying issue as #2B (`merge()` proxy reads) but applies to **direct prop access** (`props.X`) rather than merged-props. The principle is identical: one-time reads from reactive proxies in the component body need `untrack()`.

---

## 29. Astro Integration — SSR Changes for Solid 2

### Symptoms

- Astro SSR crashes with `Suspense is not exported from solid-js`
- Hydration fails silently — client component doesn't become interactive
- SSR of browser-only components crashes the entire page build
- Store reconciliation (`reconcile`) import errors from `solid-js/store`

### Root Cause

The `@astrojs/solid-js` integration (v7.x) imports from Solid 1 paths and uses APIs removed in Solid 2:

1. **`solid-js/web`** → must become `@solidjs/web`
2. **`Suspense`** → renamed to `Loading` in `@solidjs/web`
3. **`createStore` + `reconcile` from `solid-js/store`** → `createStore` moved to `solid-js`; `reconcile` removed (use draft-based mutation)
4. **`renderToStringAsync`** — still exists in `@solidjs/web` but may throw on browser-only components during SSR

### Fix — Fork the Integration

Fork `@astrojs/solid-js` (6 source files) and patch:

```typescript
// server.ts — key changes
import { renderToStringAsync } from '@solidjs/web'  // not solid-js/web
import { Loading } from '@solidjs/web'              // not Suspense

// Wrap renderToStaticMarkup in try-catch for browser-only components
async function renderToStaticMarkup(Component, props, slotted, metadata) {
  try {
    const html = await renderToStringAsync(() => /* ... */)
    return { html }
  } catch {
    return { html: '' }  // graceful fallback — component hydrates client-side
  }
}
```

```typescript
// client.ts — key changes
import { createStore } from 'solid-js'    // not solid-js/store
import { Loading } from '@solidjs/web'    // not Suspense

// Replace reconcile with draft-based mutation
setState(s => {
  Object.assign(s, newProps)  // or iterate and assign each key
})
```

### `check()` Function

The integration's `check()` validates whether a component belongs to Solid. In a single-framework project, make it permissive:

```typescript
function check(Component) {
  return typeof Component === 'function'  // always true for Solid components
}
```

### SSR Guard Pattern

Components using browser APIs (`window`, `document`, `IntersectionObserver`) must guard against SSR:

```typescript
const Component = () => {
  // Safe: runs during SSR but short-circuits
  if (typeof window === 'undefined') return null

  // Browser-only code here
  window.addEventListener('scroll', handler)
  onCleanup(() => window.removeEventListener('scroll', handler))
}
```

Alternatively, use `client:only` on the Astro island to skip SSR entirely:

```astro
<Component client:only="solid-js" />
```

### `VoidComponent` Still Exists

Despite early migration docs suggesting `VoidComponent` was removed, it still exists in `solid-js@2.0.0-beta.19`. No rename needed — keep using it.

### Where This Applies

Any Astro 5+ project using Solid 2 components needs a forked integration until `@astrojs/solid-js` officially supports Solid 2. The fork is minimal (6 files, ~200 lines of changes).

---

## Links

- [Solid 2.0 Migration Guide](https://github.com/solidjs/solid/blob/next/documentation/solid-2.0/MIGRATION.md)
- [Solid 2.0 Beta Announcement](https://github.com/solidjs/solid/discussions/2596)
- [@corvu-next npm](https://www.npmjs.com/org/corvu-next)
- [@corvu-next GitHub](https://github.com/opencenter-cloud/corvu-next)
