# @corvu-next Changelog

## Provenance

This is a Solid 2 fork of the [corvudev/corvu](https://github.com/corvudev/corvu) monorepo,
maintained separately because upstream is dormant (last release May 2025, last commit Aug 2025).

Base commit: `ff79bca96ead89a703637c0738191e20e1ffa67d` (upstream `main`)

Note: upstream has a stalled `features/solid-v2` branch (last commit Feb 14, 2025) that
targeted `2.0.0-experimental.1`. That branch's API assumptions (`mergeProps` from
`@solidjs/web`) no longer match beta.15 (`merge` from `solid-js`), so this fork starts
fresh from `main` rather than rebasing the stalled branch.

Original package versions this fork is derived from:

| @corvu-next package        | Upstream package          | Upstream version |
|----------------------------|---------------------------|------------------|
| @corvu-next/utils          | @corvu/utils              | 0.4.2            |
| @corvu-next/presence       | solid-presence            | 0.2.0            |
| @corvu-next/prevent-scroll | solid-prevent-scroll      | 0.1.10           |
| @corvu-next/focus-trap     | solid-focus-trap          | 0.1.7            |
| @corvu-next/dismissible    | solid-dismissible         | 0.1.1            |
| @corvu-next/list           | solid-list                | 0.1.x            |

## 0.1.0 — 2026-07-02 (initial fork)

Ported all packages to Solid 2.0.0-beta.15:

- Split-phase `createEffect` (compute + apply phases)
- Return cleanup functions from apply phase (replacing `onCleanup`)
- `mergeProps` → `merge`, `splitProps` → `omit`
- `solid-js/web` imports → `@solidjs/web` (`Portal`, `Dynamic`, `render`, `isServer`)
- JSX types (`JSX`, `ComponentProps`) imported from `@solidjs/web`
- `tsconfig.json` `jsxImportSource` set to `@solidjs/web`
- `createEffect(fn, initialValue)` rewritten as `createEffect((prev = initialValue) => fn, applyFn)`
  using default parameter pattern

No behavioral or API changes to the primitives themselves — same options, same return shapes.

## Unreleased — stable Solid 2.0.3

All packages now target the stable Solid 2 release line instead of `2.0.0-beta.19`.

- `solid-js` and `@solidjs/web` peer ranges are `^2.0.0`; the repository develops and builds
  against `2.0.3`. No prerelease of Solid, its compiler or its Vite plugin is left anywhere in
  the dependency tree.
- Published packages reference each other through the workspace, so a release can no longer
  ship a package that depends on an older version of its own siblings.
- `dist/index.js` is compiled by `@solidjs/compiler` (Solid 2's own compiler, also used by
  `@solidjs/vite-plugin`) instead of the Solid 1 Babel preset that `esbuild-plugin-solid`
  pulled in. Package output is unchanged: `dist/index.js` (compiled), `dist/index.jsx`
  (JSX preserved, served through the `solid` export condition) and `dist/index.d.ts`.
- The Astro integration and the example app moved from `vite-plugin-solid` to its successor
  `@solidjs/vite-plugin` 3.0.1, which requires Vite 8 or 9 and Node 22.12 or newer.
- Server rendering in the Astro integration uses `renderToStream`, as stable Solid 2 removed
  `renderToStringAsync`.
- `@corvu-next/transition-size` no longer throws when the observed element disappears while a
  size transition is running.
- **A prop passed as `undefined` takes corvu's default again, everywhere.** Solid 1's
  `mergeProps` skipped a source whose value for a key was `undefined`; Solid 2's `merge`
  takes the last source that *has* the key, `undefined` included. A consumer forwarding an
  optional prop they were not given — `<Dialog trapFocus={props.trapFocus} />` — therefore
  turned the default off, and `trapFocus` turning off is a dialog that traps nothing and
  focuses nothing when it opens. Every default in every package is now merged through
  `mergeDefaults` from `@corvu-next/utils/reactivity`, which answers each key the defaults
  name with the consumer's value where they gave one that is not `undefined` and the
  default otherwise. A value they did pass still decides, `false`, `0` and `null`
  included, and a prop that becomes defined later — or `undefined` again — is followed.
- **The OTP field's hidden input says `spellcheck="false"` again.** `spellcheck` is an
  enumerated attribute, not a boolean one: the word `false` turns spellchecking off, and no
  attribute at all leaves it inherited. Solid 1 stringified the `false` into the attribute;
  Solid 2 renders a `false` by removing it, which turned spellchecking back on over the
  input corvu hides behind the slots. The word is written now. Every other attribute these
  packages render was checked: the state attributes consumers style on (`data-open`,
  `data-closed`, `data-expanded`, `data-collapsed`, `data-active`, `data-dragging`,
  `data-transitioning`, `data-opening`, `data-closing`, `data-snapping`, `data-resizing`,
  `data-selected`, `data-disabled`, …) all go through `dataIf`, which renders an empty
  attribute or none — what upstream rendered and what `[data-open]` selects on — and every
  `aria-*` one already writes the word.
- **`@corvu-next/transition-size` no longer reads a signal in a scope that cannot track
  it.** Whether a size transition is running was kept in a signal that the `ResizeObserver`
  callback, the `transitionend` listener and the effect's cleanup all read back; from the
  cleanup that is a read inside a reactive scope that is not tracking, which Solid 2's dev
  build reports as `STRICT_READ_UNTRACKED`, and from the observer it is a value a write
  made in the same frame has not reached. It is plain state those callbacks own now, with
  the signal written beside it for what renders from it.
- **A dialog opened after it was mounted locks the page behind it again.** `@corvu-next/presence`
  decided "did `show` just change?" by threading the previous `show` through its effect's own
  compute result. A compute runs for every dependency it has — and this one also reads the
  element's computed styles, so it runs again when the element's ref commits, which is the
  same flush `open` flips in. The second run then saw its own `show` as the previous one, the
  edge was gone, and the state stayed `hidden`: `contentPresent()` stayed false, and with it
  the scroll lock, which is gated on it, never engaged. The previous `show` is now a plain
  variable the effect's apply phase owns, which runs once per change. A dialog whose content
  is not behind a portal is the shape that showed it: mounted closed and then opened, it left
  `body` scrollable and attached no wheel listener.
- **The drawer's drag works again.** A signal write is staged until the end of the frame
  it was made in, so a handler that writes one and reads it back in the same frame sees
  the value from before it. `Drawer.Content` read the dragging flag and the live translate
  back out of the context while dragging, so a `touchstart`, `touchmove`, `touchend`
  sequence delivered within one frame re-anchored the drag on every move — the drawer
  never moved — and the release bailed out before snapping, so dragging a sheet past the
  dismiss threshold did not close it. The drag's own bookkeeping is plain state the
  handlers own now; the signals are still written, for everything that renders from them.
- **The OTP field is active as soon as it is focused.** Its focus handler wrote the focus
  flag and then synced the selection, which read that same flag back and still saw the
  field as unfocused, so no slot was active and no caret was shown. The handler hands its
  own answer to the sync instead.
- `@corvu-next/resizable` renormalises the panels that stay when one unmounts, so the sizes
  keep summing to 1 within their bounds: removing one of two equal panels reports `[1]`,
  not `[0]`.
- `@corvu-next/resizable` places a panel by where its element sits in the document rather
  than by when it registers. A write is staged until the end of the frame that made it, so
  every panel of one frame used to read the panel list through the accessor as it was
  before the frame — empty — take index 0, and add an entry to a controlled `sizes` that
  already described every panel. The list is now read, and kept sorted by document
  position, from inside its own setter, which is handed the value staged earlier in the
  same frame. Registration order is not the layout either: nothing guarantees that the
  panels of one frame register in document order, so the first `initialSizes` entry could
  land on the last panel. A panel whose size comes from `initialSizes` now follows the
  sorted list, and each registration re-derives those panels' entries from their place in
  the list as it then stands, so a panel registering in front of others moves them to their
  own entries. A panel stops following the moment anything else sets sizes: `resize`,
  `collapse`, `expand`, a drag, a key, or the consumer's own `setSizes`. It is the move
  that counts, not the number, so a panel put back on exactly its entry stays where the
  consumer left it.
- `@corvu-next/resizable` writes every layout one way, and this is that way:
  - **Exact sizes.** A size the layout can give as it was asked for comes back exactly, to
    the six decimal places sizes are kept at: the panel being resized, collapsed or
    expanded, and a panel joining at its own `initialSize`, its entry or the default. A
    request the other panels' bounds cut short is not a size anyone was given, so that
    panel's size is derived like any other.
  - **Bounds, at every write.** A size is reported only where its panel may rest: inside
    `minSize` and `maxSize`, rounded inward, so `minSize={1/7}` comes back as `0.142858`
    and never `0.142857`. A panel that can collapse rests either on its collapsed size or
    anywhere from its minimum to its maximum, never in the gap between them. Sizes are
    fractions of the root and stay what they are when the root is resized; a `minSize` or
    `maxSize` given in pixels is resolved against the root and held at the next write, not
    the moment the root changes size.
  - **Collapsed.** Whether a panel is collapsed is read through the same rounding the write
    applies, everywhere it is asked — `collapsed`, the collapse, expand and keyboard paths,
    and the distribution itself — so a `collapsedSize={1/11}` still reads as collapsed.
  - **What the rounding leaves over** is carried by the panels the write derived, the
    largest of them first and on a tie the first of them, each taking as much of it as its
    own bounds allow and passing the rest to the next. A drag or a key asks for no size in
    particular, so every panel it moves is derived; a lone panel resizing itself derives
    nothing, and nothing is carried.
  - **Where bounds and the total disagree, the bounds win.** Three panels that may not be
    smaller than two fifths all sit at two fifths and the layout is reported at 1.2;
    maximums that cannot take the size an unmounting panel gives up leave those panels at
    their maximums and the layout short of the root; a panel joining a layout with less
    room than it asked for takes the room that is left, and its own minimum over that, with
    the panels already there giving the shortfall where their own bounds allow.
    Apart from those, and rounding of at most n × 10⁻⁶, a layout sums to 1, and the next
    write with room in it brings the total back.
  - **A resize fills a layout that is not full.** It moves size between the panels and the
    write then shares out whatever they are away from the root, so a resize, drag or key
    takes the room a panel still to mount would have had. That is how corvu behaved before
    this port too; it is written down here now.
  - **A frame is laid out in document order, not in the order it settled in.** The panels
    that register in one frame are folded onto the layout that frame began with, in
    document order, applying corvu's own join rule to each in turn: its `initialSize`, else
    its `initialSizes` entry, else the default half, with the panels already there giving
    an equal share of it when they fill the root. Every registration of the frame folds the
    whole frame again, so which panel of it the runtime settles last makes no difference.
    That is the layout corvu produced on Solid 1, where panels registered in document
    order; on Solid 2 they settle in reverse, which would otherwise flip it. Nothing about
    the defaults or the rule changes. A frame mounting later is real time, not an arbitrary
    order: its panels join the layout on screen, one after another in document order, so
    two panels on screen at `[0.5, 0.5]` and a third shown in front of them give
    `[0.5, 0.25, 0.25]`, as they did on Solid 1.
  - **Every write goes through that step:** a resize, a collapse, an expand, a drag, a key,
    a panel joining the layout and the panels that stay when one unmounts, a controlled
    root's own resizes and drags included. A panel joining a layout that is not full is the
    exception: no room is shared out, and the entries the consumer gave are rounded into the
    sizes their panels may rest at — which covers a rejoin after an unmount left the layout
    short as well as the first frame mounting. Where the layout they describe does not fit
    the root, a panel its own bound raised holds at that bound and every other panel shares
    what is over, within its own bounds: no panel is singled out for being the one that
    registered last, so the layout is the same whichever of a frame's panels that was. A layout written
    with a number of panels that does not match its number of sizes throws, naming both.
- `createControllableSignal` leaves composition of functional writes to Solid's own setter,
  which applies them to the value staged earlier in the same frame, and keeps its own ledger
  only for the controlled path, where nothing is written locally. `@corvu-next/utils` and
  `@corvu-next/resizable` carry the first unit tests in the repository, run by `pnpm test`.
- **A trigger rendered `as` anything but a button no longer flashes a native `type`.**
  `DynamicButton` — what `Tooltip.Trigger`, `Dialog.Trigger`, `Dialog.Close`,
  `Disclosure.Trigger` and the calendar's nav buttons all render — decided whether the
  element is a real button by measuring the tag name of the *mounted* node through a ref,
  starting from a `button` fallback. Solid's spread applies a ref and the attributes beside
  it in one effect, so that measurement wrote a signal the very same effect read `type` and
  `role` back through: the effect re-ran on its own write (Solid's dev build raises
  `EFFECT_WRITES_OWN_SOURCE` under its attribution engine, which a dev server runs), the
  flush settled in two passes, and in between `<Tooltip.Trigger as="div">` sat in the
  document carrying `type="button"` with no `role`. Server rendering had no second pass at
  all, so that wrong markup is what it shipped. The tag name is now read off the prop that
  decides it — a string `as` *is* the tag, and `button` stands for the default and for a
  component `as`, which renders what it likes with `type` and `role` handed to it as props
  — so the element is configured before it is inserted and the ref is nothing but the
  consumer's own. `@corvu-next/utils/create/tagName` is unchanged and still exported.
- **A reactive prop reaches the effect that uses it, wherever a consumer passes one.**
  An effect's apply phase tracks nothing, so a prop read there is a value frozen at the
  first run — Solid's dev build raises `STRICT_READ_UNTRACKED` on it — and three
  primitives read one there. `createFloating` read `placement` and `strategy` from inside
  `autoUpdate`'s callback, whose first call runs in that phase, so a floating element
  stayed where the first position put it; both are read in the compute phase now, and a
  new placement repositions the element. `createPreventScroll` read
  `preventScrollbarShift` and `preventScrollbarShiftMode` while styling the body, so the
  compensation never changed from padding to margin or turned off; they are compute-phase
  reads now, while `restoreScrollPosition` stays where it belongs — in the style's
  cleanup, read `untrack`ed, because it is decided when the style is reverted, not when it
  was applied. `Dismissible` read `dismissibleId` while registering the layer, so a new id
  never reached the registry and the cleanup removed whichever id happened to be current;
  the id now travels through the compute phase beside `enabled`, so each run registers and
  removes the same one. The id is also kept out of the props spread handed to
  `createDismissible`, which has no use for it and reads every key of that spread once,
  untracked. `@corvu-next/prevent-scroll` and `@corvu-next/dismissible` now carry unit
  tests, run on Solid's development build, with any dev diagnostic failing the test.
- **A `DynamicButton` hands the element exactly one ref.** The consumer's `ref` was passed
  to the element and then handed to it a second time by the props spread, which still
  carried it. `omit` drops it from the spread now, so the one ref the element gets is the
  consumer's, normalized into a callback.
- **State a dev server's diagnostics name is derived, not kept in sync by an effect.** Solid's
  attribution engine — what a dev server runs, and what raises `EFFECT_WRITES_OWN_SOURCE` and
  `EFFECT_RELAY_TEAR` — is now enabled in this repository's own test setup, one file at the root
  that every package loads, and a test fails on every diagnostic it raises. What it found, and what
  each one meant on screen:
  - **A resizable handle's aria values** (which panel it sizes, where that panel stands between its
    bounds) are measured from where the mounted handle sits between the panels, through the ref the
    spread writes. Handed to that same spread, the attributes made it re-run on its own write: two
    flushes, with the handle in the document carrying no aria values in between, and the same
    valueless markup from SSR. They are written to the element by an effect of their own now.
  - **A drawer's content** is transformed by its own measured size, so the ref write, the size
    measurement and the style closed a cycle that settled in three flushes, each rendering the
    drawer at an intermediate place. The drawer's own transform, transition duration and transition
    size are written to the element now; the consumer's `style` still goes through the spread.
  - **The presence of an element** is derived from `show` rather than written to by an effect. The
    effect made every reader run twice for one write of `show` — once against the presence of the
    frame before — so `<Show when={present()}>` painted a frame of the old presence under the new
    `show`. The one case `show` does not decide, an exit animation still playing, is carried by the
    previous state and the element's own animation events.
  - **The dismissible layer stacks** are the layers that are enabled: a layer registers its id and a
    derivation of when it last turned on, both read where a stack is read, and leaves the registry
    when it unmounts. A stack an effect wrote made every reader run twice for one write of
    `enabled`, so the frame a dialog opened in still named the layer below it as the last one. A
    stack is ordered by when each layer became enabled, as `solid-dismissible` orders it: the layer
    enabled last is the layer on top, and a layer turned off and on again goes back on top. Mount
    order decides nothing, because a consumer that mounts every layer up front and only flips
    `enabled` mounts them in no meaningful order.
  - **The stack of utilities preventing scroll** is derived the same way, from when each utility
    became enabled: the one enabled last is the one that listens, so the dialog behind an open
    dialog never cancels a wheel or touch event inside it.
  - **A resizable handle registers itself from its effect's callback**, not from the compute that
    gathers what the registration needs. Registering pairs the handle with the touching handles of
    other resizables and writes THEIR intersection signals, which from a computation is a write
    made while a computation is running: Solid refuses it and throws, and the throw escaped after
    the handle had been added to the global list and before the unregister was in place — so the
    handle carried no intersection affordance, could not drag one, and stayed in the list for the
    life of the page after its resizable unmounted. The registration runs in the callback now, with
    the orientation, the alt-key mode and both intersection flags handed to it through the compute,
    and it returns the unregister.
  - **A measured size is derived from the element it describes.** `createSize` measured from an
    effect and wrote a signal, so everything reading the size ran once against the element with the
    size of the element before it, and again a flush later — for a drawer, a frame of the new
    content at the old content's height. The size is a memo over the element and the dimension now,
    invalidated by the `ResizeObserver` from the browser's own callback, so a reader gets an
    element and its size together.
  - **A drawer's presence and its closing transition are derived from `open`.** An effect wrote
    both, so the content element applied its props once in the flush `open` changed in — still
    carrying the drawer's state from before it — and again in the next one. The content is present
    from the moment `open` turns on until the closing transition has finished, and it is closing
    from the moment `open` turns off; the states only a paint or a drag can know — `opening`,
    `snapping`, and the end of each — are still written, and each of those writes applies the
    element's props again in the flush it lands in. What the derivation removes is the second
    apply within the flush `open` changed in, which is what `Root.test.tsx` measures: it counts
    the applies of that flush alone and starts the next count before the paint the transition
    is scheduled from.
  - **A resizable handle's aria values are compared as values.** The memo rebuilds them whenever
    the panels, their sizes or the root's measured size change, and most of those changes leave
    the handle standing where it stood; the rebuilt object read as a change, so the effect that
    writes the four attributes re-ran for every one of them. The memo now compares the four
    values it carries (`UNSTABLE_MEMO_OUTPUT`).

  No finding is waived: every diagnostic Solid raises, at every severity, fails the test that
  raised it, and the engine runs with its own checks on — the ones that judge a graph over
  several runs, not just one write. Nothing is allowed by name either, so a diagnostic Solid
  adds is covered the day it ships.
