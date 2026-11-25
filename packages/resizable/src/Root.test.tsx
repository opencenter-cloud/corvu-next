import { afterEach, describe, expect, test, vi } from 'vitest'
import { createSignal, flush, Show } from 'solid-js'
import Resizable from '@src/index'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'
import { fixLayoutToPrecision } from '@src/lib/utils'

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
    // from the three. Those three tie for largest among the panels this write
    // derived, and the first of them carries what the rounding leaves.
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

  test('the panel asked for keeps its size even when it is the largest', () => {
    const onSizesChange = vi.fn()
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
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([
      0.333333, 0.333333, 0.333333,
    ])

    // Thirds cannot be kept to six places, so this write has a remainder of a
    // place to put somewhere, and the panel asked for is the largest in the
    // layout: a rule that gave the remainder to the largest panel would take
    // it off this one and report `0.500001` for a `0.5` that was asked for.
    // The largest derived panel carries it instead.
    resizeFirst!(0.5)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes[0]).toBe(0.5)
    expect(sizes).toEqual([0.5, 0.166666, 0.333334])
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })

  test('a size pinned to a bound is reported inside it, and a panel with room carries', () => {
    const onSizesChange = vi.fn()
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel minSize={1 / 7} />
        <Resizable.Panel />
      </Resizable>
    ))

    // A seventh is not a size of six places. The panel pinned to it rounds up
    // rather than to the nearest, so it is never reported below its own
    // minimum, and the panel that is not pinned carries the remainder that
    // rounding up leaves.
    resizeFirst!(0.8)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.8, 0.142858, 0.057142])
    expect(sizes[1]).toBeGreaterThanOrEqual(1 / 7)
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 6)
  })

  test('a resize the bounds cut short gives the panel that asked a derived size', () => {
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

    // Asking for more than the layout has pins all three other panels to
    // minimums that are none of them sizes of six places, and each rounds up
    // into its own bound. The `0.9` asked for was not given, so that panel's
    // size is derived like any other and it carries what the rounding left.
    resizeFirst!(0.9)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.745686, 0.142858, 0.058824, 0.052632])
    expect(sizes[1]).toBeGreaterThanOrEqual(1 / 7)
    expect(sizes[2]).toBeGreaterThanOrEqual(1 / 17)
    expect(sizes[3]).toBeGreaterThanOrEqual(1 / 19)
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )

    setFifthPanel(true)
    flush()

    // The layout is full, so the panel that joins takes its room from the
    // four rather than being added on top of them, at exactly its default.
    const joined = onSizesChange.mock.lastCall![0] as number[]
    expect(joined[4]).toBe(0.5)
    expect(joined.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('the request and the bounds win when no derived panel has room', () => {
    const onSizesChange = vi.fn()
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable initialSizes={[0.5, 0.25, 0.25]} onSizesChange={onSizesChange}>
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel maxSize={1 / 3} />
        <Resizable.Panel maxSize={1 / 3} />
      </Resizable>
    ))

    // A third is given exactly, and the two panels that take the rest are
    // pinned to maximums of a third, which round down. The remainder would
    // have to go up, and neither derived panel can take it without passing
    // its maximum: the request and the bounds hold, and the total is left a
    // place short of 1, well inside the n × 10⁻⁶ that still counts as full.
    resizeFirst!(1 / 3)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.333333, 0.333333, 0.333333])
    expect(sizes[1]).toBeLessThanOrEqual(1 / 3)
    expect(sizes[2]).toBeLessThanOrEqual(1 / 3)
    const total = sizes.reduce((totalSize, size) => totalSize + size, 0)
    expect(total).not.toBe(1)
    expect(Math.abs(total - 1)).toBeLessThanOrEqual(sizes.length * 1e-6)
  })

  test('a collapsible panel resting on its minimum is reported inside it', () => {
    const onSizesChange = vi.fn()
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel collapsible minSize={1 / 7} />
        <Resizable.Panel />
      </Resizable>
    ))

    // A panel that can collapse is open here, so its sizes are its minimum
    // and maximum like any other panel's — the collapsed size is not a size
    // it may rest between.
    resizeFirst!(0.8)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.8, 0.142858, 0.057142])
    expect(sizes[1]).toBeGreaterThanOrEqual(1 / 7)
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel collapsed to an eleventh reads as collapsed and expands back', () => {
    const onSizesChange = vi.fn()
    let collapseSecond: ((strategy?: 'following') => void) | null = null
    let expandSecond: ((strategy?: 'following') => void) | null = null

    // The first panel is held at one size, so the panel that collapses
    // reaches its collapse threshold instead of stopping at its minimum, and
    // the third panel takes the size it gives up — and gives it back when the
    // panel expands.
    const mounted = mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel minSize={0.5} maxSize={0.5} />
        <Resizable.Panel collapsible collapsedSize={1 / 11} minSize={1 / 7}>
          {(props) => {
            collapseSecond = props.collapse
            expandSecond = props.expand
            return (
              <span>
                {props.collapsed === true ? 'collapsed' : 'open'} {props.size}
              </span>
            )
          }}
        </Resizable.Panel>
        <Resizable.Panel />
      </Resizable>
    ))

    collapseSecond!('following')
    flush()

    // An eleventh is not a size the layout can store, so the panel rests on
    // the size the write gives it, and that is the size a collapse is read
    // against.
    const collapsedSizes = onSizesChange.mock.lastCall![0] as number[]
    expect(collapsedSizes).toEqual([0.5, 0.090909, 0.409091])
    expect(collapsedSizes[1]).toBe(0.090909)
    expect(mounted.textContent).toBe('collapsed 0.090909')
    expect(
      collapsedSizes.reduce((totalSize, size) => totalSize + size, 0),
    ).toBeCloseTo(1, 6)

    expandSecond!('following')
    flush()

    const expandedSizes = onSizesChange.mock.lastCall![0] as number[]
    expect(expandedSizes).toEqual([0.5, 0.142858, 0.357142])
    expect(expandedSizes[1]).toBeGreaterThanOrEqual(1 / 7)
    expect(mounted.textContent).toBe(`open ${expandedSizes[1]}`)
    expect(
      expandedSizes.reduce((totalSize, size) => totalSize + size, 0),
    ).toBeCloseTo(1, 6)
  })

  test('a collapsed panel keeps its size beside a panel pinned at its maximum', () => {
    const onSizesChange = vi.fn()
    let resizeLast: ((size: number) => void) | null = null
    let collapseSecond: ((strategy?: 'following') => void) | null = null

    const mounted = mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel minSize={0.5} maxSize={7 / 12} />
        <Resizable.Panel collapsible collapsedSize={1 / 11} minSize={1 / 7}>
          {(props) => {
            collapseSecond = props.collapse
            return (
              <span>{props.collapsed === true ? 'collapsed' : 'open'}</span>
            )
          }}
        </Resizable.Panel>
        <Resizable.Panel>
          {(props) => {
            resizeLast = props.resize
            return null
          }}
        </Resizable.Panel>
      </Resizable>
    ))

    collapseSecond!('following')
    flush()
    expect(mounted.textContent).toBe('collapsed')

    // Asking the third panel to give up more than the first can take pins the
    // first to a maximum of seven twelfths, which rounds down. The collapsed
    // panel rests on one size and has room for nothing, so it keeps that size
    // and goes on reading as collapsed, and the panel whose request was cut
    // short carries what the rounding left.
    resizeLast!(0.3)
    flush()

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.583333, 0.090909, 0.325758])
    expect(sizes[0]).toBe(0.583333)
    expect(sizes[0]).toBeLessThanOrEqual(7 / 12)
    expect(sizes[1]).toBe(0.090909)
    expect(mounted.textContent).toBe('collapsed')
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('writing a layout with the wrong number of panels throws', () => {
    expect(() =>
      fixLayoutToPrecision({
        sizes: [0.5, 0.5],
        constraints: [{ minSize: 0, maxSize: 1, collapsedSize: null }],
        requestedPanel: null,
        requestedSize: null,
      }),
    ).toThrow('2 sizes was written with 1 panels')
  })

  test('a lone panel takes the whole root and carries nothing', () => {
    const onSizesChange = vi.fn()
    let resizeOnly: ((size: number) => void) | null = null

    const mounted = mount(() => (
      <Resizable onSizesChange={onSizesChange}>
        <Resizable.Panel>
          {(props) => {
            resizeOnly = props.resize
            return <span>{props.size}</span>
          }}
        </Resizable.Panel>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.5])
    expect(mounted.textContent).toBe('0.5')

    // There is no other panel to take the size from, so the `0.8` asked for
    // cannot be given: the panel holds a derived size, and a layout of one
    // panel is the whole root.
    resizeOnly!(0.8)
    flush()

    expect(onSizesChange).toHaveBeenLastCalledWith([1])
    expect(mounted.textContent).toBe('1')

    // Asked for the whole root, which it can be given, the panel is the one
    // panel of the write and nothing is derived from it. There is no panel to
    // put a remainder on, so none is carried and the size is reported as it
    // was asked for.
    resizeOnly!(1)
    flush()

    expect(onSizesChange).toHaveBeenLastCalledWith([1])
    expect(mounted.textContent).toBe('1')
  })

  test('a keyboard resize derives every panel and the largest carries', () => {
    const onSizesChange = vi.fn()

    const mounted = mount(() => (
      <Resizable
        initialSizes={[1 / 3, 1 / 3, 1 / 3]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel />
        <Resizable.Handle />
        <Resizable.Panel />
        <Resizable.Panel />
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([
      0.333333, 0.333333, 0.333333,
    ])

    const handle = mounted.querySelector('[data-corvu-resizable-handle]')!
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    flush()

    // A key asks for no panel's size in particular — it moves a handle by the
    // root's `keyboardDelta` — so every panel is derived, and the largest of
    // them carries what the rounding of thirds leaves over.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.433334, 0.233333, 0.333333])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel joining beside panels at their minimums takes what is left', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(false)

    mount(() => (
      <Resizable onSizesChange={onSizesChange}>
        <Resizable.Panel minSize={0.45} />
        <Resizable.Panel minSize={0.45} />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.5, 0.5])

    setThirdPanel(true)
    flush()

    // The panel that joins takes its size out of the panels that have room
    // for it, as a resize does. They can only give a tenth between them
    // without passing their minimums, so that is what it gets: its default
    // `0.5` was not given, and the layout still fills the root.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.45, 0.45, 0.1])
    expect(sizes[0]).toBeGreaterThanOrEqual(0.45)
    expect(sizes[1]).toBeGreaterThanOrEqual(0.45)
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel joining beside panels at their maximums gets its size', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(false)

    mount(() => (
      <Resizable onSizesChange={onSizesChange}>
        <Resizable.Panel maxSize={0.5} />
        <Resizable.Panel maxSize={0.5} />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.5, 0.5])

    setThirdPanel(true)
    flush()

    // A maximum holds a panel back from growing, not from giving room away,
    // so both can give and the panel that joins gets exactly its default.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes[2]).toBe(0.5)
    expect(sizes).toEqual([0.25, 0.25, 0.5])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('minimums that cannot all hold together win over the total', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(false)

    mount(() => (
      <Resizable onSizesChange={onSizesChange}>
        <Resizable.Panel minSize={0.4} />
        <Resizable.Panel minSize={0.4} />
        <Show when={thirdPanel()}>
          <Resizable.Panel minSize={0.4} />
        </Show>
      </Resizable>
    ))

    setThirdPanel(true)
    flush()

    // Three panels that may not be smaller than two fifths do not fit in one
    // root. The panels there cannot give the panel that joined the size it
    // asked for, so it is derived and takes what is left — nothing — raised
    // only as far as its own minimum. Every panel sits at its minimum and the
    // total is the sum of the minimums: the bounds the consumer gave win over
    // the total, and the sizes that do not fit are theirs to fix.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.4, 0.4, 0.4])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1.2,
      6,
    )
  })

  test('a collapsed panel stays collapsed when a sibling unmounts', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(true)

    const mounted = mount(() => (
      <Resizable initialSizes={[0, 0.6, 0.4]} onSizesChange={onSizesChange}>
        <Resizable.Panel collapsible minSize={0.2}>
          {(props) => (
            <span>{props.collapsed === true ? 'collapsed' : 'open'}</span>
          )}
        </Resizable.Panel>
        <Resizable.Panel />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0, 0.6, 0.4])
    expect(mounted.textContent).toBe('collapsed')

    setThirdPanel(false)
    flush()

    // The panels that stay share what the one that left gave up, and a
    // collapsed panel has no room for a share: the open panel takes all of it
    // and the collapsed one is still collapsed.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0, 1])
    expect(mounted.textContent).toBe('collapsed')
  })

  test('unmounting beside panels at their maximums leaves the layout short', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(true)

    mount(() => (
      <Resizable initialSizes={[0.3, 0.3, 0.4]} onSizesChange={onSizesChange}>
        <Resizable.Panel maxSize={0.3} />
        <Resizable.Panel maxSize={0.3} />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.3, 0.3, 0.4])

    setThirdPanel(false)
    flush()

    // Neither panel that stays may grow, so there is nowhere for the size the
    // one that left gave up to go. Bounds win: the layout is left short of
    // the root, and the next write with room in it fills it again.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.3, 0.3])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      0.6,
      6,
    )
  })

  test('a resize on a controlled root is written by the step and echoes once', () => {
    const onSizesChange = vi.fn()
    const [controlledSizes, setControlledSizes] = createSignal([0.5, 0.5])
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable
        sizes={controlledSizes()}
        onSizesChange={(sizes) => {
          onSizesChange(sizes)
          setControlledSizes(sizes)
        }}
      >
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel />
      </Resizable>
    ))

    // The consumer's own layout is reported back to nobody.
    expect(onSizesChange).not.toHaveBeenCalled()

    resizeFirst!(1 / 3)
    flush()

    // A controlled root's resize goes through the same write: the size asked
    // for comes back exactly, and the layout fills the root.
    expect(onSizesChange).toHaveBeenCalledTimes(1)
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.333333, 0.666667])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )

    flush()

    // The consumer wrote that layout back into `sizes`, and their own value is
    // not reported to them a second time.
    expect(onSizesChange).toHaveBeenCalledTimes(1)

    // A resize of the layout they echoed back is written the same way again.
    resizeFirst!(0.25)
    flush()

    expect(onSizesChange).toHaveBeenCalledTimes(2)
    const resizedAgain = onSizesChange.mock.lastCall![0] as number[]
    expect(resizedAgain).toEqual([0.25, 0.75])
    expect(
      resizedAgain.reduce((totalSize, size) => totalSize + size, 0),
    ).toBeCloseTo(1, 6)
  })

  test('what one derived panel cannot carry passes to the next', () => {
    const onSizesChange = vi.fn()
    const [fourthPanel, setFourthPanel] = createSignal(true)

    mount(() => (
      <Resizable
        initialSizes={[0.5, 0.3, 0.1, 0.1]}
        onSizesChange={onSizesChange}
      >
        <Resizable.Panel maxSize={0.54} />
        <Resizable.Panel maxSize={0.32} />
        <Resizable.Panel />
        <Show when={fourthPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    expect(onSizesChange).toHaveBeenLastCalledWith([0.5, 0.3, 0.1, 0.1])

    setFourthPanel(false)
    flush()

    // The three that stay share what the one that left gave up, and two of
    // them are held back by a maximum. The largest can take a place and a
    // half of what the rounding into those maximums leaves over, the second
    // is at its maximum and can take none, and the third takes the rest: the
    // layout fills the root again.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.54, 0.32, 0.14])
    expect(sizes[0]).toBeLessThanOrEqual(0.54)
    expect(sizes[1]).toBeLessThanOrEqual(0.32)
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel rejoining a layout left short takes the room that is left', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(true)

    mount(() => (
      <Resizable initialSizes={[0.3, 0.3, 0.4]} onSizesChange={onSizesChange}>
        <Resizable.Panel maxSize={0.3} />
        <Resizable.Panel maxSize={0.3} />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    setThirdPanel(false)
    flush()
    expect(onSizesChange).toHaveBeenLastCalledWith([0.3, 0.3])

    setThirdPanel(true)
    flush()

    // The panels that stayed are pinned to their maximums, so that layout is
    // short of the root. A panel joining it takes the room that is left rather
    // than its default `0.5`, which would stack on top of the root.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.3, 0.3, 0.4])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel rejoining with a minimum past the room left keeps its minimum', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(true)

    mount(() => (
      <Resizable initialSizes={[0.3, 0.3, 0.4]} onSizesChange={onSizesChange}>
        <Resizable.Panel maxSize={0.3} />
        <Resizable.Panel maxSize={0.3} />
        <Show when={thirdPanel()}>
          <Resizable.Panel minSize={0.6} />
        </Show>
      </Resizable>
    ))

    setThirdPanel(false)
    flush()
    expect(onSizesChange).toHaveBeenLastCalledWith([0.3, 0.3])

    setThirdPanel(true)
    flush()

    // Only four tenths are left, and the panel joining may not be smaller than
    // six. A bound of the consumer's wins over the total, as everywhere else:
    // it takes its minimum and the layout is reported over-full.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.3, 0.3, 0.6])
    expect(sizes[2]).toBeGreaterThanOrEqual(0.6)
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1.2,
      6,
    )
  })

  test('a panel joining beside a collapsed panel leaves it collapsed', () => {
    const onSizesChange = vi.fn()
    const [fourthPanel, setFourthPanel] = createSignal(false)
    let collapseSecond: ((strategy?: 'following') => void) | null = null

    const mounted = mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel minSize={0.5} maxSize={0.5} />
        <Resizable.Panel collapsible collapsedSize={1 / 11} minSize={1 / 7}>
          {(props) => {
            collapseSecond = props.collapse
            return (
              <span>{props.collapsed === true ? 'collapsed' : 'open'}</span>
            )
          }}
        </Resizable.Panel>
        <Resizable.Panel />
        <Show when={fourthPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    collapseSecond!('following')
    flush()
    expect(mounted.textContent).toBe('collapsed')

    setFourthPanel(true)
    flush()

    // The panels of a full layout give up an equal share for the one that
    // joins, and a collapsed panel has none to give: it keeps the size it
    // rests at, the panels with room give what they can, and the panel that
    // joined takes what is left.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.5, 0.090909, 0.242424, 0.166667])
    expect(sizes[1]).toBe(0.090909)
    expect(mounted.textContent).toBe('collapsed')
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })

  test('a panel unmounting after a resize shares what it gave up', () => {
    const onSizesChange = vi.fn()
    const [thirdPanel, setThirdPanel] = createSignal(true)
    let resizeFirst: ((size: number) => void) | null = null

    mount(() => (
      <Resizable initialSizes={[0.5, 0.3, 0.2]} onSizesChange={onSizesChange}>
        <Resizable.Panel>
          {(props) => {
            resizeFirst = props.resize
            return null
          }}
        </Resizable.Panel>
        <Resizable.Panel />
        <Show when={thirdPanel()}>
          <Resizable.Panel />
        </Show>
      </Resizable>
    ))

    resizeFirst!(0.6)
    flush()
    const resized = onSizesChange.mock.lastCall![0] as number[]
    expect(resized).toEqual([0.6, 0.2, 0.2])

    setThirdPanel(false)
    flush()

    // A layout a resize left is as full as any other, so the panels that stay
    // share what the one that left gave up.
    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toEqual([0.7, 0.3])
    expect(sizes.reduce((totalSize, size) => totalSize + size, 0)).toBeCloseTo(
      1,
      6,
    )
  })
})
