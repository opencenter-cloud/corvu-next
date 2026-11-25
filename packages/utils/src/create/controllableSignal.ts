import {
  type Accessor,
  createSignal,
  type Setter,
  untrack,
} from 'solid-js'

// A plain tuple return type — Solid 2's `Signal<T>` requires a branded
// `SourceAccessor<T>` which a hand-built accessor cannot satisfy.
type ControllableSignal<T> = [Accessor<T>, Setter<T>]

/**
 * Creates a simple reactive state with a getter and setter. Can be controlled by providing your own state through the `value` prop.
 * @param props.value - Controlled value of the state.
 * @param props.initialValue - Initial value of the state.
 * @param props.onChange - Callback fired when the value changes.
 * @param props.equals - Compares the current value with the next one and returns `true` when the two are the same, in which case the write is dropped and `onChange` does not fire. Defaults to `Object.is`; pass a comparator for values carried in a fresh object or array every write.
 * @returns ```typescript
 * [state: Accessor<T>, setState: Setter<T>]
 * ```
 */
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  onChange?: (value: T) => void
  equals?: (prev: T | undefined, next: T) => boolean
  ownedWrite?: boolean
}): ControllableSignal<T | undefined>
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  initialValue: T
  onChange?: (value: T) => void
  equals?: (prev: T | undefined, next: T) => boolean
  ownedWrite?: boolean
}): ControllableSignal<T>
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  initialValue?: T
  onChange?: (value: T) => void
  equals?: (prev: T | undefined, next: T) => boolean
  ownedWrite?: boolean
}): ControllableSignal<T | undefined> {
  // Solid 2's `createSignal` overload signature excludes Function from the
  // value slot (functions are treated as compute functions). We use `any`
  // internally to sidestep the generic constraint and reassert types at the
  // public boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [uncontrolledSignal, setUncontrolledSignal] = createSignal<any>(
    props.initialValue,
    props.ownedWrite ? { ownedWrite: true } : undefined,
  )

  const isControlled = () => props.value?.() !== undefined
  const value: Accessor<T | undefined> = () =>
    isControlled() ? (props.value?.() as T) : (uncontrolledSignal() as T)

  // In the controlled path nothing is written locally: `props.value()` keeps
  // reporting the owner's value until they apply the change they were told
  // about, which is never within the frame the change was reported in. The
  // value last reported is remembered here so a second write in the same
  // frame builds on the first — two panels registering in one settle, a
  // value set twice in one handler — instead of starting from a value that
  // is already superseded.
  //
  // The uncontrolled path needs no such ledger: a functional write handed to
  // Solid's own setter is applied to that signal's staged value, so writes in
  // one frame compose there already.
  let reported: { base: T | undefined; value: T } | null = null

  const controlledBase = (): T | undefined => {
    const current = props.value?.()
    if (reported !== null) {
      const applied = Object.is(current, reported.value)
      const movedOn = !Object.is(current, reported.base)
      if (applied || movedOn) {
        reported = null
      } else {
        return reported.value
      }
    }
    return current
  }

  const setValue: Setter<T | undefined> = ((next?: unknown) => {
    return untrack(() => {
      let prevValue: T | undefined
      let nextValue!: T
      let unchanged = false

      const apply = (prev: T | undefined): T => {
        prevValue = prev
        nextValue =
          typeof next === 'function'
            ? (next as (prev: T | undefined) => T)(prev)
            : (next as T)
        unchanged = props.equals
          ? props.equals(prev, nextValue)
          : Object.is(prev, nextValue)
        // Handing the previous value back leaves Solid's own equality gate to
        // drop the write, so a value this signal calls unchanged stages
        // nothing and wakes no reader.
        return unchanged ? (prev as T) : nextValue
      }

      if (isControlled()) {
        apply(controlledBase())
      } else {
        // A functional write: Solid resolves it against the value staged by
        // an earlier write in this frame, which is the composition this
        // signal would otherwise have to keep itself.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUncontrolledSignal(apply as any)
      }

      if (!unchanged) {
        if (isControlled()) {
          const thisWrite = { base: prevValue, value: nextValue }
          reported = thisWrite
          // It stands in for the owner's value only for the rest of this
          // frame: by the next microtask they have applied the change, or
          // declined it, and a later write has to start from what they really
          // report — including repeating a change they declined once.
          queueMicrotask(() => {
            if (reported === thisWrite) reported = null
          })
        }
        props.onChange?.(nextValue)
      }
      return nextValue as never
    })
  }) as Setter<T | undefined>

  return [value, setValue]
}

export default createControllableSignal
