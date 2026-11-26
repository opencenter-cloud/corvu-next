import { afterEach, describe, expect, test } from 'vitest'
import { createSignal, flush, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { render } from '@solidjs/web'
import Resizable from '@src/index'

let dispose: (() => void) | null = null
let container: HTMLElement | null = null

const mount = (component: () => JSX.Element) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(component, container)
  // Handles register from an effect, and the registration writes the
  // intersection of every handle it pairs, so the pairing is settled one
  // flush after the write.
  flush()
  return container
}

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

/** Handles pair by where they sit on the page, which a test environment does
 *  not lay out: each handle of these tests says where it is. */
const stubRect = (
  element: HTMLElement,
  rect: { top: number; bottom: number; left: number; right: number },
) => {
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      toJSON: () => rect,
    }) as DOMRect
}

/** A handle lying across the page, whose bottom edge is the line below. */
const acrossRect = { top: 100, bottom: 110, left: 0, right: 200 }
/** A handle running down the page from that line, so its top edge touches
 *  the bottom edge above: the two handles meet at a corner. */
const downRect = { top: 110, bottom: 300, left: 100, right: 110 }
const END_INTERSECTION = '[data-corvu-resizable-handle-end-intersection]'
/** The four the handle owns and writes itself, in the order it writes them. */
const ARIA_ATTRIBUTES = [
  'aria-controls',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
] as const

describe('Resizable.Handle', () => {
  test('pairs with the touching handle of another resizable', () => {
    let across!: HTMLElement
    let down!: HTMLElement

    mount(() => (
      <>
        <Resizable orientation="horizontal">
          <Resizable.Panel />
          <Resizable.Handle
            ref={(element: HTMLElement) => {
              across = element
              stubRect(element, acrossRect)
            }}
          />
          <Resizable.Panel />
        </Resizable>
        <Resizable orientation="vertical">
          <Resizable.Panel />
          <Resizable.Handle
            ref={(element: HTMLElement) => {
              down = element
              stubRect(element, downRect)
            }}
          />
          <Resizable.Panel />
        </Resizable>
      </>
    ))

    // The handle that paired the two drags: a registration that threw would
    // leave it without the callbacks its pointer handler drags through.
    down.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
    )
    flush()
    expect(down.hasAttribute('data-dragging')).toBe(true)

    // And the handle running down the page starts where the other one ends,
    // so that one carries the intersection affordance that drags both.
    expect(across.querySelector(END_INTERSECTION)).not.toBeNull()
  })

  test('unregisters a handle when its resizable unmounts', () => {
    const [down, setDown] = createSignal(true)
    const [second, setSecond] = createSignal(false)
    let secondAcross!: HTMLElement

    mount(() => (
      <>
        <Resizable orientation="horizontal">
          <Resizable.Panel />
          <Resizable.Handle
            ref={(element: HTMLElement) => stubRect(element, acrossRect)}
          />
          <Resizable.Panel />
        </Resizable>
        <Show when={down()}>
          <Resizable orientation="vertical">
            <Resizable.Panel />
            <Resizable.Handle
              ref={(element: HTMLElement) => stubRect(element, downRect)}
            />
            <Resizable.Panel />
          </Resizable>
        </Show>
        <Show when={second()}>
          <Resizable orientation="horizontal">
            <Resizable.Panel />
            <Resizable.Handle
              ref={(element: HTMLElement) => {
                secondAcross = element
                stubRect(element, acrossRect)
              }}
            />
            <Resizable.Panel />
          </Resizable>
        </Show>
      </>
    ))

    setDown(false)
    flush()

    setSecond(true)
    flush()

    // The handle it would have touched is gone, so there is nothing for the
    // handle that just mounted to intersect with.
    expect(secondAcross.querySelector(END_INTERSECTION)).toBeNull()
  })

  /**
   * The handle's aria values are rebuilt whenever the panels, their sizes or
   * the root's measured size change, and most of those changes leave the
   * handle standing exactly where it stood. A rebuilt object that says the
   * same thing is not a change, and a memo that reports it as one re-runs
   * every subscriber — here, the effect that writes four attributes.
   *
   * Five orientation changes, one past the four consecutive equal-but-new
   * outputs the attribution engine reports, so the guard does not sit on its
   * threshold; and the four attributes are read back from the element, so
   * the re-application is caught as DOM writes rather than only as a
   * diagnostic.
   */
  test('reports no change while the handle stands where it stood', () => {
    const [orientation, setOrientation] = createSignal<
      'horizontal' | 'vertical'
    >('horizontal')

    // Two sizes the consumer controls, so the layout is the same whichever
    // way the panels are laid out, while the root is measured in a different
    // dimension each time — the memo re-runs, and says the same thing.
    const mounted = mount(() => (
      <Resizable
        orientation={orientation()}
        sizes={[0.5, 0.5]}
        ref={(element: HTMLElement) => {
          Object.defineProperty(element, 'offsetWidth', { value: 200 })
          Object.defineProperty(element, 'offsetHeight', { value: 800 })
        }}
      >
        <Resizable.Panel />
        <Resizable.Handle />
        <Resizable.Panel />
      </Resizable>
    ))

    const handle = mounted.querySelector('[data-corvu-resizable-handle]')!
    const firstPanel = mounted.querySelector('[data-corvu-resizable-panel]')!

    // What the handle says before anything moves, so the writes below can be
    // compared against it rather than against a value copied into the test.
    const settled = ARIA_ATTRIBUTES.map((name) => handle.getAttribute(name))
    expect(settled).toEqual([firstPanel.id, '1', '0', '0.5'])

    // Every write of one of the four, whatever value it writes: the element
    // says the same thing after a re-application as before it, so counting
    // the writes is the only way the test can see one.
    let applies = 0
    const write = handle.setAttribute.bind(handle)
    handle.setAttribute = (name: string, value: string) => {
      if ((ARIA_ATTRIBUTES as readonly string[]).includes(name)) applies++
      write(name, value)
    }

    for (const next of [
      'vertical',
      'horizontal',
      'vertical',
      'horizontal',
      'vertical',
    ] as const) {
      setOrientation(next)
      flush()
    }

    expect(ARIA_ATTRIBUTES.map((name) => handle.getAttribute(name))).toEqual(
      settled,
    )
    expect(applies).toBe(0)
  })
})
