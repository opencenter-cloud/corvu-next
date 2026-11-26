import { createEffect, createRoot, createSignal, flush } from 'solid-js'
import { afterEach, describe, expect, test } from 'vitest'
import { render } from '@solidjs/web'
import Dismissible, { activeDismissibles } from '@src/Dismissible'

let dispose: (() => void) | null = null
let element: HTMLElement | null = null

afterEach(() => {
  dispose?.()
  element?.remove()
  dispose = null
  element = null
})

/**
 * The comment on the stack the layers register in: it is derived from what
 * the layers are, so a reader of it settles in the flush `enabled` changed
 * in. A stack an effect wrote made every reader run twice for one write —
 * once against the stack as it was, once after the write landed
 * (`EFFECT_RELAY_TEAR`) — so the frame a dialog opened in still named the
 * layer below it as the last one.
 *
 * The layer's id is what it registers itself under and what its cleanup
 * removes, and a consumer may hand it over as a signal. It is read in the
 * effect's compute phase, beside `enabled`: read from the apply phase
 * instead, Solid raises `STRICT_READ_UNTRACKED` (`vitest.setup.ts` fails the
 * test on any diagnostic) and a new id never reaches the registry, because
 * the effect does not depend on it.
 */
describe('Dismissible', () => {
  test('a reactive dismissibleId is the id that is registered', () => {
    const [dismissibleId, setDismissibleId] = createSignal('first')

    element = document.createElement('div')
    document.body.appendChild(element)
    dispose = render(
      () => (
        <Dismissible
          enabled
          dismissibleId={dismissibleId()}
          element={() => element}
          onDismiss={() => {}}
        >
          {null}
        </Dismissible>
      ),
      element,
    )
    flush()

    expect(activeDismissibles()).toEqual(['first'])

    setDismissibleId('second')
    flush()

    expect(activeDismissibles()).toEqual(['second'])
  })

  test('a reader of the stack settles in the flush enabled changed in', () => {
    const [enabled, setEnabled] = createSignal(false)
    let runs = 0
    let seen = ''

    element = document.createElement('div')
    document.body.appendChild(element)
    const disposeLayer = render(
      () => (
        <Dismissible
          enabled={enabled()}
          dismissibleId="layer"
          element={() => element}
          onDismiss={() => {}}
        >
          {null}
        </Dismissible>
      ),
      element,
    )
    // A reader of both the layer's own state and the stack: with a stack an
    // effect kept in sync, this runs once with `enabled` already true and the
    // stack still empty, and again once the write lands.
    const disposeReader = createRoot((disposeRoot) => {
      createEffect(
        () => `${enabled()}:${activeDismissibles().join(',')}`,
        (frame) => {
          runs++
          seen = frame
        },
      )
      return disposeRoot
    })
    dispose = () => {
      disposeReader()
      disposeLayer()
    }
    flush()

    const runsAfterMount = runs
    expect(seen).toBe('false:')

    setEnabled(true)
    flush()

    expect(seen).toBe('true:layer')
    expect(runs).toBe(runsAfterMount + 1)
  })

  /**
   * The layer on top is the one enabled last, not the one mounted first. A
   * consumer that mounts its layers up front and only flips `enabled`
   * mounts them in no meaningful order, so a stack ordered by mounting left
   * the layer below the open one taking the escape key and the outside
   * pointer. A layer that is turned off and on again goes back on top.
   */
  test('the layer enabled last is the layer on top', () => {
    const [enabledA, setEnabledA] = createSignal(false)
    const [enabledB, setEnabledB] = createSignal(false)

    element = document.createElement('div')
    document.body.appendChild(element)
    const elementA = document.createElement('div')
    const elementB = document.createElement('div')
    element.append(elementA, elementB)
    const disposeA = render(
      () => (
        <Dismissible
          enabled={enabledA()}
          dismissibleId="a"
          element={() => elementA}
          onDismiss={() => {}}
        >
          {null}
        </Dismissible>
      ),
      elementA,
    )
    const disposeB = render(
      () => (
        <Dismissible
          enabled={enabledB()}
          dismissibleId="b"
          element={() => elementB}
          onDismiss={() => {}}
        >
          {null}
        </Dismissible>
      ),
      elementB,
    )
    dispose = () => {
      disposeA()
      disposeB()
    }
    flush()

    expect(activeDismissibles()).toEqual([])

    setEnabledB(true)
    flush()
    expect(activeDismissibles()).toEqual(['b'])

    // A mounted first and was enabled last, so A is on top.
    setEnabledA(true)
    flush()
    expect(activeDismissibles()).toEqual(['b', 'a'])

    setEnabledA(false)
    flush()
    expect(activeDismissibles()).toEqual(['b'])

    // Re-enabling A takes a fresh stamp, so A is back on top.
    setEnabledA(true)
    flush()
    expect(activeDismissibles()).toEqual(['b', 'a'])
  })
})
