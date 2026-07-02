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
 * @returns ```typescript
 * [state: Accessor<T>, setState: Setter<T>]
 * ```
 */
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  onChange?: (value: T) => void
}): ControllableSignal<T | undefined>
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  initialValue: T
  onChange?: (value: T) => void
}): ControllableSignal<T>
function createControllableSignal<T>(props: {
  value?: Accessor<T | undefined>
  initialValue?: T
  onChange?: (value: T) => void
}): ControllableSignal<T | undefined> {
  // Solid 2's `createSignal` overload signature excludes Function from the
  // value slot (functions are treated as compute functions). We use `any`
  // internally to sidestep the generic constraint and reassert types at the
  // public boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [uncontrolledSignal, setUncontrolledSignal] = createSignal<any>(
    props.initialValue,
  )

  const isControlled = () => props.value?.() !== undefined
  const value: Accessor<T | undefined> = () =>
    isControlled() ? (props.value?.() as T) : (uncontrolledSignal() as T)

  const setValue: Setter<T | undefined> = ((next?: unknown) => {
    return untrack(() => {
      let nextValue: T
      if (typeof next === 'function') {
        nextValue = (next as (prev: T | undefined) => T)(value())
      } else {
        nextValue = next as T
      }

      if (!Object.is(nextValue, value())) {
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
