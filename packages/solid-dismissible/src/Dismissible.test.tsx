import { createSignal, flush } from 'solid-js'
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
})
