import { createRoot, createSignal, flush } from 'solid-js'
import { describe, expect, test, vi } from 'vitest'
import createControllableSignal from '@src/create/controllableSignal'

/**
 * Creates the signal under an owner, as a component would, and hands back the
 * tuple plus its disposal. The writes themselves happen outside the root:
 * writing from inside a reactive scope is what `ownedWrite` is for, and these
 * cases are about composition, not about that gate.
 */
const inRoot = <T>(fn: () => T): [T, () => void] => {
  let dispose!: () => void
  const result = createRoot((disposeRoot) => {
    dispose = disposeRoot
    return fn()
  })
  return [result, dispose]
}

const sameSizes = (prev: number[] | undefined, next: number[]) =>
  prev !== undefined &&
  prev.length === next.length &&
  prev.every((size, index) => size === next[index])

describe('createControllableSignal', () => {
  test('composes two functional writes made in the same frame', () => {
    const [[value, setValue], dispose] = inRoot(() =>
      createControllableSignal<number[]>({ initialValue: [] }),
    )

    setValue((prev) => [...prev, 1])
    setValue((prev) => [...prev, 2])
    flush()

    expect(value()).toEqual([1, 2])
    dispose()
  })

  test('composes functional writes against the value it last reported while controlled', () => {
    const onChange = vi.fn()
    const [controlled] = createSignal([0.7, 0.3])
    const [[value, setValue], dispose] = inRoot(() =>
      createControllableSignal<number[]>({
        value: controlled,
        initialValue: [],
        onChange,
      }),
    )

    setValue((prev) => [...prev, 0.1])
    setValue((prev) => [...prev, 0.2])
    flush()

    // The second write starts from what the first one reported, not from the
    // owner's value, which cannot have moved yet.
    expect(onChange).toHaveBeenNthCalledWith(1, [0.7, 0.3, 0.1])
    expect(onChange).toHaveBeenNthCalledWith(2, [0.7, 0.3, 0.1, 0.2])
    expect(value()).toEqual([0.7, 0.3])
    dispose()
  })

  test('reports a change to the owner of a controlled value without echoing it back', async () => {
    const onChange = vi.fn()
    const [controlled, setControlled] = createSignal([0.7, 0.3])
    const [[value, setValue], dispose] = inRoot(() =>
      createControllableSignal<number[]>({
        value: controlled,
        initialValue: [],
        onChange,
      }),
    )

    setValue([0.5, 0.5])
    flush()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([0.5, 0.5])
    // Nothing was written locally: the owner still decides what the value is.
    expect(value()).toEqual([0.7, 0.3])

    setControlled([0.5, 0.5])
    flush()

    expect(value()).toEqual([0.5, 0.5])
    // Applying the change does not report it a second time.
    expect(onChange).toHaveBeenCalledTimes(1)
    dispose()
  })

  test('drops a write its `equals` calls unchanged', () => {
    const onChange = vi.fn()
    const [[value, setValue], dispose] = inRoot(() =>
      createControllableSignal<number[]>({
        initialValue: [0.7, 0.3],
        equals: sameSizes,
        onChange,
      }),
    )

    const before = value()
    setValue([0.7, 0.3])
    flush()

    expect(onChange).not.toHaveBeenCalled()
    // A fresh array of the same numbers is not a change, so nothing is staged
    // and readers keep the value they already have.
    expect(value()).toBe(before)

    setValue([0.6, 0.4])
    flush()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([0.6, 0.4])
    expect(value()).toEqual([0.6, 0.4])
    dispose()
  })
})
