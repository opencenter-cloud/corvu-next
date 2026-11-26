import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { createSignal, flush } from 'solid-js'
import Drawer from '@src/index'
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

/** The drawer sizes itself from the content element's offset size, which a
 *  DOM without layout reports as 0. Every drawer here is 400px tall. */
beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 400,
  })
})

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

/** Two animation frames, which is what `afterPaint` waits for: the drawer
 *  settles its transition there. */
const afterPaint = () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  return promise
}

describe('Drawer.Root', () => {
  test('applies the content element props once per open change', async () => {
    const [open, setOpen] = createSignal(false)

    /** A prop of the consumer's that is derived from the same `open` the
     *  drawer is given. The content element applies all of its props in one
     *  effect, so counting how often this one is read counts how often the
     *  element was written — once per change of `open`, unless the drawer
     *  relays `open` through a state of its own and makes the element apply
     *  a second time with the drawer's state from before the change. */
    let applies = 0
    const label = () => {
      applies++
      return open() ? 'open' : 'closed'
    }

    mount(() => (
      <Drawer open={open()} onOpenChange={setOpen}>
        <Drawer.Portal forceMount>
          <Drawer.Content forceMount aria-label={label()}>
            drawer
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    ))

    const content = document.querySelector<HTMLElement>(
      '[data-corvu-drawer-content]',
    )!

    const appliesPerChange: number[] = []
    for (const isOpen of [true, false, true, false, true]) {
      applies = 0
      setOpen(isOpen)
      flush()
      appliesPerChange.push(applies)

      // The element carries the drawer's state in the very flush `open`
      // changed in, not one later: it is closing from the moment `open`
      // turns off, and no longer closing the moment it turns back on.
      expect(content.getAttribute('aria-label')).toBe(
        isOpen ? 'open' : 'closed',
      )
      expect(content.hasAttribute('data-closing')).toBe(!isOpen)

      await afterPaint()
      flush()
    }

    expect(appliesPerChange).toEqual([1, 1, 1, 1, 1])
  })
})
