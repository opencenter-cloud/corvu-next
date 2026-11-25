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

  /**
   * Every part of the dialog, mounted open. The package's vitest setup fails
   * a test on any dev diagnostic Solid raises, so this also says that no
   * part of it reads a reactive value in a strict-read window.
   */
  test('an open dialog renders its state as the attributes consumers style', () => {
    mount(() => (
      <Dialog initialOpen>
        <Dialog.Trigger>open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Label>label</Dialog.Label>
            <Dialog.Description>description</Dialog.Description>
            <Dialog.Close>close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    const trigger = document.querySelector('[data-corvu-dialog-trigger]')!
    const overlay = document.querySelector('[data-corvu-dialog-overlay]')!
    const content = document.querySelector('[data-corvu-dialog-content]')!

    // corvu's state attributes are present or absent, never the string
    // "true" or "false": consumers select on `[data-open]`.
    for (const element of [trigger, overlay, content]) {
      expect(element.getAttribute('data-open')).toBe('')
      expect(element.hasAttribute('data-closed')).toBe(false)
    }

    // An `aria-*` attribute is enumerated: it has to say the word, and an
    // absent `aria-modal` is not the same as `aria-modal="false"`.
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(content.getAttribute('aria-modal')).toBe('true')
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(content.getAttribute('role')).toBe('dialog')
    expect(content.getAttribute('aria-labelledby')).toBe(
      document.querySelector('[data-corvu-dialog-label]')!.id,
    )
  })

  test('a closed dialog says so on the trigger, and not with a word', () => {
    mount(() => (
      <Dialog>
        <Dialog.Trigger>open</Dialog.Trigger>
      </Dialog>
    ))

    const trigger = document.querySelector('[data-corvu-dialog-trigger]')!
    expect(trigger.getAttribute('data-closed')).toBe('')
    expect(trigger.hasAttribute('data-open')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  test('a non-modal dialog says aria-modal false', () => {
    mount(() => (
      <Dialog initialOpen modal={false}>
        <Dialog.Portal>
          <Dialog.Content>content</Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    const content = document.querySelector('[data-corvu-dialog-content]')!
    expect(content.getAttribute('aria-modal')).toBe('false')
  })

  /**
   * The close path, under the same diagnostics: the dismissible layer, the
   * focus trap's restore and the scroll lock all tear down here, and a read
   * of a reactive value in a strict-read window anywhere in that would fail
   * this test.
   */
  test('a dialog dismissed with Escape reports it on the trigger', async () => {
    mount(() => (
      <Dialog initialOpen>
        <Dialog.Trigger>open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>content</Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    ))

    await afterPaint()
    expect(document.querySelector('[data-corvu-dialog-content]')).not.toBe(
      null,
    )

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    flush()

    const trigger = document.querySelector('[data-corvu-dialog-trigger]')!
    const content = document.querySelector('[data-corvu-dialog-content]')!
    for (const element of [trigger, content]) {
      expect(element.getAttribute('data-closed')).toBe('')
      expect(element.hasAttribute('data-open')).toBe(false)
    }
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // The content is still in the tree: no stylesheet here ends the exit
    // animation, so presence holds it while it "hides". What the consumer's
    // CSS keys on has flipped, which is the point of this test.
  })
})
