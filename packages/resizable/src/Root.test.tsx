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
    expect(sizes[0]).toBeCloseTo(0.45, 10)
    expect(sizes[1]).toBeCloseTo(0.05, 10)
    expect(sizes[2]).toBe(0.5)
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

    const sizes = onSizesChange.mock.lastCall![0] as number[]
    expect(sizes).toHaveLength(3)
    expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(1, 10)
  })

  test('a panel the consumer sized stops following its initial size', () => {
    const onSizesChange = vi.fn()
    const [firstPanel, setFirstPanel] = createSignal(false)
    let setSizes: ((sizes: number[]) => unknown) | null = null

    mount(() => (
      <Resizable initialSizes={[0.4, 0.3]} onSizesChange={onSizesChange}>
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

    expect(onSizesChange).toHaveBeenLastCalledWith([0.4, 0.3])

    // Set away from the entries, and back onto exactly them: the numbers say
    // nothing about whether the consumer has taken the layout over, the fact
    // that they set it does.
    setSizes!([0.3, 0.4])
    flush()
    setSizes!([0.4, 0.3])
    flush()

    setFirstPanel(true)
    flush()

    // The panel that mounted in front takes the first entry. The two the
    // consumer set keep their sizes instead of being moved onto the entries
    // of their new places.
    expect(onSizesChange).toHaveBeenLastCalledWith([0.4, 0.4, 0.3])
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
})
