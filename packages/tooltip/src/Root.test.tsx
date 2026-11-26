import { afterEach, describe, expect, test } from 'vitest'
import { createSignal, flush } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'
import Tooltip from '@src/index'

let dispose: (() => void) | null = null
let container: HTMLElement | null = null

const mount = (component: () => JSX.Element) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(component, container)
  flush()
  return container
}

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

/**
 * Every part of the tooltip, mounted open. The package's vitest setup fails a
 * test on any dev diagnostic Solid raises, so this is also what says no part
 * of it reads a reactive value in a strict-read window.
 */
const mountTooltip = () =>
  mount(() => (
    <Tooltip initialOpen openOnFocus={false} openOnHover={false}>
      <Tooltip.Anchor>
        <Tooltip.Trigger>trigger</Tooltip.Trigger>
      </Tooltip.Anchor>
      <Tooltip.Portal>
        <Tooltip.Content>
          tooltip
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip>
  ))

describe('Tooltip', () => {
  test('an open tooltip renders its state as the attributes consumers style', () => {
    mountTooltip()

    const trigger = document.querySelector('[data-corvu-tooltip-trigger]')!
    const content = document.querySelector('[data-corvu-tooltip-content]')!

    // A data attribute of corvu's is present or absent, never the string
    // "true" or "false": consumers select on `[data-open]`, and Solid 2
    // renders a boolean as an empty attribute or no attribute at all.
    expect(content.getAttribute('data-open')).toBe('')
    expect(content.hasAttribute('data-closed')).toBe(false)
    expect(trigger.getAttribute('data-open')).toBe('')
    expect(trigger.hasAttribute('data-closed')).toBe(false)

    // An `aria-*` attribute is an enumerated one: it has to say the word.
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(content.getAttribute('data-placement')).toBe('bottom')
    expect(document.querySelector('[data-corvu-tooltip-arrow]')).not.toBe(null)
  })

  test('a tooltip that closes reports it on the trigger', () => {
    const [open, setOpen] = createSignal(true)

    mount(() => (
      <Tooltip open={open()} openOnFocus={false} openOnHover={false}>
        <Tooltip.Trigger>trigger</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content>tooltip</Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip>
    ))

    const trigger = document.querySelector('[data-corvu-tooltip-trigger]')!
    expect(trigger.getAttribute('aria-describedby')).not.toBe(null)

    setOpen(false)
    flush()

    expect(trigger.getAttribute('data-closed')).toBe('')
    expect(trigger.hasAttribute('data-open')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // Upstream drops the association entirely while the tooltip is closed,
    // rather than pointing at an element that is not there.
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
  })
})
