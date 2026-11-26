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
})
