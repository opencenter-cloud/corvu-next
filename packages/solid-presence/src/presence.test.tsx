import { afterEach, describe, expect, test, vi } from 'vitest'
import { createMemo, createRoot, createSignal, flush, Show } from 'solid-js'
import createPresence from '@src/presence'
import { render } from '@solidjs/web'

let dispose: (() => void) | null = null
let element: HTMLElement | null = null

const mountPresence = (show: () => boolean) =>
  createRoot((disposeRoot) => {
    dispose = disposeRoot
    element = document.createElement('div')
    document.body.appendChild(element)
    return createPresence({ show, element: () => element })
  })

afterEach(() => {
  dispose?.()
  element?.remove()
  dispose = null
  element = null
})

describe('createPresence', () => {
  /**
   * The case every consumer has: the element is mounted closed and shown
   * later. The effect's compute depends on the element's styles as well as
   * on `show`, and the element ref commits in the same flush as `show`
   * flips, so a compute that ran twice before the apply used to leave the
   * state at `hidden` — with everything gated on it, a dialog's scroll lock
   * most visibly, never engaging.
   */
  test('showing after the mount makes it present', () => {
    const onStateChange = vi.fn()
    const [show, setShow] = createSignal(false)
    const { present, state } = createRoot((disposeRoot) => {
      dispose = disposeRoot
      element = document.createElement('div')
      document.body.appendChild(element)
      return createPresence({ show, element: () => element, onStateChange })
    })

    expect(present()).toBe(false)
    expect(state()).toBe('hidden')

    setShow(true)
    flush()

    expect(state()).toBe('present')
    expect(present()).toBe(true)
    expect(onStateChange).toHaveBeenLastCalledWith('present')
  })

  test('a presence mounted shown is present from the start', () => {
    const { present, state } = mountPresence(() => true)

    expect(state()).toBe('present')
    expect(present()).toBe(true)
  })

  test('hiding with no animation to run hides it at once', () => {
    const [show, setShow] = createSignal(true)
    const { present, state } = mountPresence(show)
    element!.style.animationName = 'none'

    expect(present()).toBe(true)

    setShow(false)
    flush()

    // The element says it has no animation, so there is nothing to wait for.
    expect(state()).toBe('hidden')
    expect(present()).toBe(false)
  })

  test('showing, hiding and showing again is followed every time', () => {
    const [show, setShow] = createSignal(false)
    const { state } = mountPresence(show)
    element!.style.animationName = 'fade'

    setShow(true)
    flush()
    expect(state()).toBe('present')

    setShow(false)
    flush()
    // An element with an animation to run goes through `hiding`, and counts
    // as present while it does.
    expect(state()).toBe('hiding')

    setShow(true)
    flush()
    expect(state()).toBe('present')
  })

  /**
   * The shape a dialog has: the element is rendered when `show` turns on, so
   * its ref commits in the same flush as `show` flips. The effect's compute
   * reads both, so it runs again for the element after it has run for
   * `show`, and only the last result reaches the apply phase. Deriving "what
   * `show` was before" from the previous compute result lost the edge there,
   * and the presence stayed `hidden` — with everything gated on it, a
   * dialog's scroll lock most visibly, never engaging.
   */
  test('an element rendered with the show still makes it present', () => {
    const [show, setShow] = createSignal(false)
    const [shownElement, setShownElement] = createSignal<HTMLElement | null>(
      null,
    )
    let present!: () => boolean
    let state!: () => 'present' | 'hiding' | 'hidden'

    const container = document.createElement('div')
    document.body.appendChild(container)
    dispose = render(
      () => {
        const presence = createPresence({ show, element: shownElement })
        present = presence.present
        state = presence.state
        return (
          <Show when={show()}>
            <div ref={setShownElement}>content</div>
          </Show>
        )
      },
      container,
    )
    flush()

    expect(state()).toBe('hidden')

    setShow(true)
    flush()

    expect(state()).toBe('present')
    expect(present()).toBe(true)

    container.remove()
  })

  /**
   * The presence is derived from `show`, not written to by an effect: an
   * effect that wrote it made every reader run twice for one write of
   * `show` — once against the presence of the frame before, once after the
   * write landed — so `<Show when={present()}>` painted a frame of the old
   * presence under the new `show`.
   */
  test('a reader of the presence runs once for one write of show', () => {
    const [show, setShow] = createSignal(false)
    let runs = 0

    const { present, visible } = createRoot((disposeRoot) => {
      dispose = disposeRoot
      element = document.createElement('div')
      document.body.appendChild(element)
      const presence = createPresence({ show, element: () => element })
      const visible = createMemo(() => {
        runs++
        return presence.present()
      })
      return { present: presence.present, visible }
    })

    expect(visible()).toBe(false)
    const runsAfterMount = runs

    setShow(true)
    flush()

    expect(visible()).toBe(true)
    expect(present()).toBe(true)
    expect(runs).toBe(runsAfterMount + 1)
  })
})
