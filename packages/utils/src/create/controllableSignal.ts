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
 * @param props.equals - Decides whether the next value is a change, and so whether `onChange` fires. Defaults to `Object.is`; pass a comparator for values carried in a fresh object or array every write.
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

  // Solid 2 stages a write until the next flush, so `value()` still reports
  // the previous one while a write made in this frame is in flight. The write
  // in flight is remembered here so a second write in the same frame builds on
  // the first — two panels registering in one settle, a value set twice in one
  // handler — instead of recomputing from a value that is already superseded.
  let inFlight: { base: T | undefined; value: T } | null = null

  const latestValue = (): T | undefined => {
    const committed = value()
    if (inFlight !== null) {
      const landed = Object.is(committed, inFlight.value)
      const movedOn = !Object.is(committed, inFlight.base)
      if (landed || movedOn) {
        inFlight = null
      } else {
        return inFlight.value
      }
    }
    return committed
  }

  const setValue: Setter<T | undefined> = ((next?: unknown) => {
    return untrack(() => {
      const prevValue = latestValue()

      let nextValue: T
      if (typeof next === 'function') {
        nextValue = (next as (prev: T | undefined) => T)(prevValue)
      } else {
        nextValue = next as T
      }

      const unchanged = props.equals
        ? props.equals(prevValue, nextValue)
        : Object.is(nextValue, prevValue)

      if (!unchanged) {
        const thisWrite = { base: prevValue, value: nextValue }
        inFlight = thisWrite
        // It only stands in for the value for the rest of this frame: by the
        // next microtask the write has committed, or a controlled owner has
        // declined it, and a later write has to start from what the value
        // really reports — including repeating a change they declined once.
        queueMicrotask(() => {
          if (inFlight === thisWrite) inFlight = null
        })
        if (!isControlled()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setUncontrolledSignal(nextValue as any)
        }
        props.onChange?.(nextValue)
      }
      return nextValue as never
    })
  }) as Setter<T | undefined>

  return [value, setValue]
}

export default createControllableSignal
