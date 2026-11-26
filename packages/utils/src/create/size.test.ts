import { createEffect, createRoot, createSignal, flush } from 'solid-js'
import { describe, expect, test, vi } from 'vitest'
import createSize from '@src/create/size'

/** An element that reports a width, the way a laid-out one does. */
const elementOfWidth = (width: number) => {
  const element = document.createElement('div')
  Object.defineProperty(element, 'offsetWidth', { value: width })
  return element
}

describe('createSize', () => {
  test('hands readers each element and its size in one pass', () => {
    const [element, setElement] = createSignal<HTMLElement | null>(null)
    const painted = vi.fn()

    const dispose = createRoot((dispose) => {
      const size = createSize({ element, dimension: 'width' })
      // What a consumer does with a measured element: it puts the size on
      // the element it measured, so it reads both.
      createEffect(
        () => ({ element: element(), size: size() }),
        ({ size }) => painted(size),
      )
      return dispose
    })

    flush()
    expect(painted).toHaveBeenLastCalledWith(0)

    // Three elements in turn. A size measured from an effect reaches that
    // reader a flush after the element it describes does, so the reader runs
    // twice for each — once on the element with the size of the one before
    // it — and the third sighting of that is the tear Solid raises.
    for (const width of [120, 240, 360]) {
      setElement(elementOfWidth(width))
      flush()
      expect(painted).toHaveBeenLastCalledWith(width)
    }

    expect(painted).toHaveBeenCalledTimes(4)

    dispose()
  })

  test('measures the dimension it is pointed at', () => {
    const element = document.createElement('div')
    Object.defineProperty(element, 'offsetWidth', { value: 120 })
    Object.defineProperty(element, 'offsetHeight', { value: 40 })

    const [dimension, setDimension] = createSignal<'width' | 'height'>('width')

    let size!: () => number
    const dispose = createRoot((dispose) => {
      size = createSize({ element: () => element, dimension })
      return dispose
    })

    expect(size()).toBe(120)

    setDimension('height')
    flush()
    expect(size()).toBe(40)

    dispose()
  })
})
