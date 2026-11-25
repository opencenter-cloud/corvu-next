import { afterEach, describe, expect, test, vi } from 'vitest'
import Dialog from '@src/index'
import { flush } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'

let dispose: (() => void) | null = null
let container: HTMLElement | null = null

const mount = (component: () => JSX.Element) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(component, container)
  flush()
  return container
}

/** Two animation frames: the focus trap moves focus in `afterPaint`. */
const afterPaint = () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  return promise
}

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

describe('Dialog.Root defaults', () => {
  /**
   * The case a consumer writes without thinking about it: a component of
   * theirs takes an optional prop and forwards it, so corvu is handed
   * `undefined` whenever they were given nothing. Solid 1's `mergeProps`
   * skipped an `undefined` value and the default stood; Solid 2's `merge`
   * takes the last source that has the key, so without `mergeDefaults` this
   * turns the focus trap off and nothing is focused when the dialog opens.
   */
  test('a dialog passed undefined for trapFocus still traps focus', async () => {
    const onInitialFocus = vi.fn()
    const forwarded: { trapFocus?: boolean } = {}

    mount(() => (
      <Dialog
        initialOpen
        trapFocus={forwarded.trapFocus}
        onInitialFocus={onInitialFocus}
      >
        <Dialog.Portal>
          <Dialog.Content>
            <button type="button">inside</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    await afterPaint()
    const button = document.querySelector('button')!
    expect(onInitialFocus).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(button)
  })

  test('a dialog passed undefined for role keeps the default role', () => {
    const forwarded: { role?: 'dialog' | 'alertdialog' } = {}

    mount(() => (
      <Dialog initialOpen role={forwarded.role}>
        <Dialog.Portal>
          <Dialog.Content>content</Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    const content = document.querySelector('[data-corvu-dialog-content]')!
    expect(content.getAttribute('role')).toBe('dialog')
  })

  test('a dialog given trapFocus false is not trapped', async () => {
    const onInitialFocus = vi.fn()

    mount(() => (
      <Dialog initialOpen trapFocus={false} onInitialFocus={onInitialFocus}>
        <Dialog.Portal>
          <Dialog.Content>
            <button type="button">inside</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    await afterPaint()

    // A value the consumer did pass still decides: only `undefined` falls
    // back to the default.
    expect(onInitialFocus).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(document.querySelector('button'))
  })
})
