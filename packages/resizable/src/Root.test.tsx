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
})
