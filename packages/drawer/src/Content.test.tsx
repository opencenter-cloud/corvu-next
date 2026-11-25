import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { createSignal, flush } from 'solid-js'
import Drawer from '@src/index'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'

const DRAWER_SIZE = 400

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
    get: () => DRAWER_SIZE,
  })
})

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

/** Two animation frames, which is what `afterPaint` waits for: the drawer
 *  settles on its default snap point there. */
const afterPaint = () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  return promise
}

/** A touch event carrying the one touch the drawer reads off it. Built by
 *  hand because the handlers only ever read `touches`. */
const touchEvent = (type: string, y: number | null) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const touches = y === null ? [] : [{ clientX: 0, clientY: y }]
  Object.defineProperty(event, 'touches', { value: touches })
  Object.defineProperty(event, 'changedTouches', {
    value: y === null ? [{ clientX: 0, clientY: 0 }] : touches,
  })
  return event
}

const pointerEvent = (type: string, y: number) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'button', { value: 0 })
  Object.defineProperty(event, 'pointerType', { value: 'touch' })
  Object.defineProperty(event, 'clientX', { value: 0 })
  Object.defineProperty(event, 'clientY', { value: y })
  return event
}

/** The translate the drawer is rendered at, read off the element's own
 *  transform — what the user sees. */
const renderedTranslate = (content: HTMLElement) => {
  const match = /translate3d\(0, (-?[\d.]+)px, 0\)/.exec(
    content.style.transform,
  )
  if (!match) throw new Error(`no translate in "${content.style.transform}"`)
  return parseFloat(match[1]!)
}

const openDrawer = async (onOpenChange: (open: boolean) => void) => {
  const [open, setOpen] = createSignal(false)
  mount(() => (
    <Drawer
      open={open()}
      // The whole sequence is delivered in one frame, so no time passes
      // between the moves and a velocity read off the clock would be
      // whatever the machine's timer resolution makes of a 0ms drag. These
      // tests are about where the drag leaves the drawer, so velocity is
      // off: the drawer snaps to the point it is nearest.
      velocityFunction={() => 1}
      // The only thing that may close these drawers is the drag itself: a
      // focus or a pointer landing outside the content would dismiss the
      // dialog underneath, which says nothing about dragging.
      closeOnOutsideFocus={false}
      closeOnOutsidePointer={false}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        onOpenChange(isOpen)
      }}
    >
      <Drawer.Portal>
        <Drawer.Content>drawer</Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  ))

  setOpen(true)
  flush()
  await afterPaint()
  flush()

  const content = document.querySelector<HTMLElement>(
    '[data-corvu-drawer-content]',
  )!
  expect(content.offsetHeight).toBe(DRAWER_SIZE)
  expect(renderedTranslate(content)).toBe(0)
  return content
}

describe('Drawer.Content', () => {
  test('a touch drag delivered in one frame moves the drawer', async () => {
    const onOpenChange = vi.fn()
    const content = await openDrawer(onOpenChange)

    // One frame: a browser delivers a touch sequence without anything of
    // ours running in between, and a signal written here is only applied at
    // the end of it. The first move starts the drag and anchors it; the
    // second is the drag itself.
    content.dispatchEvent(pointerEvent('pointerdown', 0))
    content.dispatchEvent(touchEvent('touchstart', 0))
    content.dispatchEvent(touchEvent('touchmove', 0))
    content.dispatchEvent(touchEvent('touchmove', 1))
    content.dispatchEvent(touchEvent('touchmove', 81))

    flush()

    // Dragged 80px down from the snap point it rests at, and the drawer is
    // where the drag left it. Reading the dragging flag back out of its
    // signal instead would re-anchor the drag on every move and leave this
    // at 0.
    expect(renderedTranslate(content)).toBe(80)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  test('a touch drag past the threshold in one frame closes the drawer', async () => {
    const onOpenChange = vi.fn()
    const content = await openDrawer(onOpenChange)

    // The whole drag, release included, inside one frame. 300 of the
    // drawer's 400px is past the halfway mark between the two snap points,
    // so the drawer snaps to the closed one and dismisses itself.
    content.dispatchEvent(pointerEvent('pointerdown', 0))
    content.dispatchEvent(touchEvent('touchstart', 0))
    content.dispatchEvent(touchEvent('touchmove', 0))
    content.dispatchEvent(touchEvent('touchmove', 1))
    content.dispatchEvent(touchEvent('touchmove', 301))
    content.dispatchEvent(touchEvent('touchend', null))

    flush()

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('a touch drag short of the threshold snaps back open', async () => {
    const onOpenChange = vi.fn()
    const content = await openDrawer(onOpenChange)

    content.dispatchEvent(pointerEvent('pointerdown', 0))
    content.dispatchEvent(touchEvent('touchstart', 0))
    content.dispatchEvent(touchEvent('touchmove', 0))
    content.dispatchEvent(touchEvent('touchmove', 1))
    content.dispatchEvent(touchEvent('touchmove', 41))
    content.dispatchEvent(touchEvent('touchend', null))

    flush()

    // 40 of 400 is nearer the open snap point, so the drawer goes back to it
    // and stays open.
    expect(renderedTranslate(content)).toBe(0)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  /**
   * The same `undefined` case as the dialog's `trapFocus`, one layer up: a
   * consumer forwarding an optional `side` they were not given must still
   * get corvu's default, which Solid 2's `merge` alone would not do.
   */
  test('a drawer passed undefined for side keeps the default side', async () => {
    const forwarded: { side?: 'top' | 'bottom' | 'left' | 'right' } = {}
    const [open, setOpen] = createSignal(false)

    mount(() => (
      <Drawer open={open()} onOpenChange={setOpen} side={forwarded.side}>
        <Drawer.Portal>
          <Drawer.Content>drawer</Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    ))

    setOpen(true)
    flush()
    await afterPaint()
    flush()

    const content = document.querySelector('[data-corvu-drawer-content]')!
    expect(content.getAttribute('data-side')).toBe('bottom')
  })
})
