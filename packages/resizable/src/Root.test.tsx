import { afterEach, describe, expect, test, vi } from 'vitest'
import { createSignal, flush, Show } from 'solid-js'
import Resizable from '@src/index'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'

let dispose: (() => void) | null = null
let container: HTMLElement | null = null

const mount = (component: () => JSX.Element) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(component, container)
  // Panels register from `onSettled`, so the layout exists only once the
  // first flush has run.
  flush()
  return container
}

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

describe('Resizable.Root', () => {
  test('renormalises the panels that stay when one unmounts', () => {
    const onSizesChange = vi.fn()
    const [twoPanels, setTwoPanels] = createSignal(true)

    mount(() => (
      <Resizable onSizesChange={onSizesChange}>
        <Resizable.Panel />
        <Show when={twoPanels()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.5, 0.5])

    setTwoPanels(false)
    flush()

    // The panel that stays takes the whole layout: the sizes always sum to 1.
    expect(onSizesChange).toHaveBeenLastCalledWith([1])
  })

  test('renormalises unequal panels when one unmounts', () => {
    const onSizesChange = vi.fn()
    const [twoPanels, setTwoPanels] = createSignal(true)

    mount(() => (
      <Resizable initialSizes={[0.7, 0.3]} onSizesChange={onSizesChange}>
        <Resizable.Panel />
        <Show when={twoPanels()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.7, 0.3])

    setTwoPanels(false)
    flush()

    expect(onSizesChange).toHaveBeenLastCalledWith([1])
  })

  test('registers two panels of a controlled layout in one settle', () => {
    const onSizesChange = vi.fn()

    const mounted = mount(() => (
      <Resizable sizes={[0.7, 0.3]} onSizesChange={onSizesChange}>
        <Resizable.Panel>{(props) => <span>{props.size}</span>}</Resizable.Panel>
        <Resizable.Panel>{(props) => <span>{props.size}</span>}</Resizable.Panel>
      </Resizable>
    ))

    // Both panels fit the sizes the consumer passed in, so there is nothing
    // to report back to them and no third entry to invent.
    expect(onSizesChange).not.toHaveBeenCalled()
    // Each panel takes its own size, in document order.
    expect(mounted.textContent).toBe('0.70.3')
  })

  test('gives each panel of one settle the initial size of its own position', () => {
    const onSizesChange = vi.fn()

    const mounted = mount(() => (
      <Resizable initialSizes={[0.7, 0.3]} onSizesChange={onSizesChange}>
        <Resizable.Panel>{(props) => <span>{props.size}</span>}</Resizable.Panel>
        <Resizable.Panel>{(props) => <span>{props.size}</span>}</Resizable.Panel>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.7, 0.3])
    expect(mounted.textContent).toBe('0.70.3')
  })

  test('moves a panel to its own initial size when an earlier one mounts', () => {
    const onSizesChange = vi.fn()
    const [firstPanel, setFirstPanel] = createSignal(false)

    const mounted = mount(() => (
      <Resizable initialSizes={[0.7, 0.3]} onSizesChange={onSizesChange}>
        <Show when={firstPanel()}>
          <Resizable.Panel>
            {(props) => <span>{props.size}</span>}
          </Resizable.Panel>
        </Show>
        <Resizable.Panel>{(props) => <span>{props.size}</span>}</Resizable.Panel>
      </Resizable>
    ))

    // Alone, the panel is the first of the layout.
    expect(mounted.textContent).toBe('0.7')

    setFirstPanel(true)
    flush()

    // The panel that mounted in front of it takes the first entry, and it
    // follows the layout to the second one.
    expect(onSizesChange).toHaveBeenLastCalledWith([0.7, 0.3])
    expect(mounted.textContent).toBe('0.70.3')
  })

  test('keeps the sizes summing to 1 when a panel without an entry joins', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(false)

    mount(() => (
      <Resizable initialSizes={[0.7, 0.3]} onSizesChange={onSizesChange}>
        <Resizable.Panel />
        <Resizable.Panel />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.7, 0.3])

    setThirdPanel(true)
    flush()

    // `initialSizes` describes two panels, so the third takes the default
    // size, and the layout it joined makes room for it: the panels that were
    // there each give up a share, and the sizes still sum to 1.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.45, 0.05, 0.5])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 10)
  })

  test('keeps the sizes summing to 1 when more panels than entries settle', () => {
    const onSizesChange = vi.fn()

    mount(() => (
      <Resizable initialSizes={[0.6, 0.4]} onSizesChange={onSizesChange}>
        <Resizable.Panel />
        <Resizable.Panel />
        <Resizable.Panel />
      </Resizable>
    ))

    // The third panel has no entry of its own, and the two entries fill the
    // layout by the time it registers, so it takes its room from them.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.6, 0.3, 0.1])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 10)
  })

  test('a panel the consumer sized stops following its initial size', () => {
    const onSizesChange = vi.fn()
    const [firstPanel, setFirstPanel] = createSignal(false)
    let setSizes: ((sizes: number[]) => unknown) | null = null

    mount(() => (
      <Resizable
        initialSizes={[0.3, 0.4, 0.3]}
        onSizesChange={onSizesChange}
      >
        {(props) => {
          setSizes = props.setSizes
          return (
            <>
              <Show when={firstPanel()}>
                <Resizable.Panel />
              </Show>
              <Resizable.Panel />
              <Resizable.Panel />
            </>
          )
        }}
      </Resizable>
    ))

    // Two of the three panels are mounted, on the first two entries.
    expect(onSizesChange).toHaveBeenLastCalledWith([0.3, 0.4])

    // Set away from those entries, and back onto exactly them: the numbers
    // say nothing about whether the consumer has taken the layout over, the
    // fact that they set it does.
    setSizes!([0.4, 0.3])
    flush()
    setSizes!([0.3, 0.4])
    flush()

    setFirstPanel(true)
    flush()

    // The panel that mounted in front takes the first entry. The two the
    // consumer set keep their sizes instead of being moved onto the entries
    // of their new places, which would have read `[0.3, 0.4, 0.3]`.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.3, 0.3, 0.4])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 10)
  })

  test('a resized layout keeps summing to 1 when a panel mounts in front', () => {
    const onSizesChange = vi.fn()
    const [firstPanel, setFirstPanel] = createSignal(false)
    let resizeLast: ((size: number) => void) | null = null

    mount(() => (
      <Resizable initialSizes={[0.6, 0.4]} onSizesChange={onSizesChange}>
        <Show when={firstPanel()}>
          <Resizable.Panel />
        </Show>
        <Resizable.Panel />
        <Resizable.Panel>
          {(props) => {
            resizeLast = props.resize
            return null
          }}
        </Resizable.Panel>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.6, 0.4])

    resizeLast!(0.5)
    flush()
    expect(onSizesChange).toHaveBeenLastCalledWith([0.5, 0.5])

    setFirstPanel(true)
    flush()

    // The resized panels make room for the one that mounted and keep what is
    // left between them; neither is written back onto an `initialSizes` entry.
    expect(onSizesChange).toHaveBeenLastCalledWith([0.6, 0.2, 0.2])
  })

  test('a layout of thirds is full when a panel without an entry joins', () => {
    const onSizesChange = vi.fn()
    const [fourthPanel, setFourthPanel] = createSignal(false)

    mount(() => (
      <Resizable
        initialSizes={[1 / 3, 1 / 3, 1 / 3]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel />
        <Resizable.Panel />
        <Resizable.Panel />
        <Show when={fourthPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    // Sizes are kept to six places, so three thirds are stored as `0.333333`
    // and their total is a place short of 1. That is a full layout.
    const thirds = onSizesChange.mock.lastCall![0] as number[]
    expect(thirds).toEqual([0.333333, 0.333333, 0.333333])
    expect(thirds.reduce((total, size) => total + size, 0)).toBe(0.999999)

    setFourthPanel(true)
    flush()

    // The fourth panel has no entry, so it joins at the default `0.5` — the
    // size that was asked for, which comes back exactly — and takes its room
    // from the three, which carry what the rounding leaves.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes[3]).toBe(0.5)
    expect(sizes).toEqual([0.166666, 0.166667, 0.166667, 0.5])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })

  test('a resize writes a layout that sums to 1, and a joining panel keeps it there', () => {
    const onSizesChange = vi.fn()
    const [fourthPanel, setFourthPanel] = createSignal(false)
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable
        initialSizes={[1 / 3, 1 / 3, 1 / 3]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel />
        <Resizable.Panel />
        <Show when={fourthPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    // The size that was asked for comes back exactly; the panels that gave it
    // room carry what the rounding leaves.
    resizeFirst!(0.4)
    flush()
    const resized = onSizesChange.mock.lastCall![0] as number[]
    expect(resized[0]).toBe(0.4)
    expect(resized).toEqual([0.4, 0.266666, 0.333334])
    expect(resized.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)

    setFourthPanel(true)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes[3]).toBe(0.5)
    expect(sizes).toEqual([0.233334, 0.099999, 0.166667, 0.5])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })

  test('a derived panel larger than the one asked for carries the remainder', () => {
    const onSizesChange = vi.fn()
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable
        initialSizes={[0.1, 0.6, 0.3]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel />
        <Resizable.Panel />
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.1, 0.6, 0.3])

    // A seventh is not a size that can be kept to six places, so this write
    // has a remainder to put somewhere. The panel asked for is the smallest
    // one, so a rule that picks the largest panel would pick a derived panel
    // here too — but it would have picked this one had it been the biggest.
    resizeFirst!(1 / 7)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes[0]).toBe(0.142857)
    expect(sizes).toEqual([0.142857, 0.557143, 0.3])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })

  test('a resize that pins panels to bounds of their own keeps the sum at 1', () => {
    const onSizesChange = vi.fn()
    const [fifthPanel, setFifthPanel] = createSignal(false)
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable
        initialSizes={[0.25, 0.25, 0.25, 0.25]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel minSize={1 / 7} />
        <Resizable.Panel minSize={1 / 17} />
        <Resizable.Panel minSize={1 / 19} />
        <Show when={fifthPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    // A seventh, a seventeenth and a nineteenth are none of them sizes that
    // can be kept to six places. Asking for more than the layout has pins all
    // three panels to those bounds, and rounding each of them moves the total
    // the same way: without a remainder carried by a derived panel the layout
    // comes out at 1.000001 and keeps walking with every write like it.
    resizeFirst!(0.9)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.745688, 0.142858, 0.058823, 0.052631])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)

    setFifthPanel(true)
    flush()

    // And the layout is still full, so the panel that joins takes its room
    // from the four rather than being added on top of them.
    const joined = onSizesChange.mock.lastCall![0] as number[]
    expect(joined[4]).toBe(0.5)
    expect(joined.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })
})
