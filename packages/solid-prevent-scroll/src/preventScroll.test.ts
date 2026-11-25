import { createRoot, createSignal, flush, OBSERVE } from 'solid-js'
import { afterEach, describe, expect, test } from 'vitest'
import createPreventScroll from '@src/preventScroll'

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  document.body.removeAttribute('style')
})

/**
 * `preventScrollbarShift` and `preventScrollbarShiftMode` decide how the body
 * is styled while scrolling is prevented, and a consumer may hand either of
 * them over as a signal — corvu's own dialog hands every one of these props
 * on as a thunk over its props. They are read in the effect's compute phase:
 * read from the apply phase instead, Solid raises `STRICT_READ_UNTRACKED`
 * (`vitest.setup.ts` fails the test on any diagnostic) and the body keeps the
 * style the first run gave it.
 */
describe('createPreventScroll', () => {
  test('a reactive shift mode restyles the body', () => {
    const [mode, setMode] = createSignal<'padding' | 'margin'>('padding')

    createRoot((disposeRoot) => {
      dispose = disposeRoot
      createPreventScroll({
        enabled: true,
        preventScrollbarShiftMode: mode,
      })
    })
    flush()

    expect(document.body.style.paddingRight).not.toBe('')
    expect(document.body.style.marginRight).toBe('')

    setMode('margin')
    flush()

    expect(document.body.style.marginRight).not.toBe('')
    expect(document.body.style.paddingRight).toBe('')
  })

  test('a reactive preventScrollbarShift turns the compensation off', () => {
    const [preventScrollbarShift, setPreventScrollbarShift] =
      createSignal(true)

    createRoot((disposeRoot) => {
      dispose = disposeRoot
      createPreventScroll({
        enabled: true,
        preventScrollbarShift,
      })
    })
    flush()

    expect(document.body.style.paddingRight).not.toBe('')

    setPreventScrollbarShift(false)
    flush()

    expect(document.body.style.paddingRight).toBe('')
    expect(document.body.style.overflow).toBe('hidden')
  })

  /**
   * The stack of utilities preventing scroll is derived from what they are,
   * not kept in sync by an effect. The utility's own listener effect reads
   * both its `enabled` and its place in that stack, so a stack an effect
   * wrote made it run twice for one write of `enabled` — once with the new
   * `enabled` against the stack as it was — which Solid reports as
   * `EFFECT_RELAY_TEAR`.
   */
  test('turning a utility off settles the stack in that flush', () => {
    const [enabled, setEnabled] = createSignal(true)
    const codes: string[] = []

    createRoot((disposeRoot) => {
      dispose = disposeRoot
      createPreventScroll({ enabled })
    })
    flush()

    const unsubscribe = OBSERVE!.diagnostics.subscribe((event) => {
      codes.push(event.code)
    })

    setEnabled(false)
    flush()
    unsubscribe()

    expect(codes).toEqual([])
    expect(document.body.style.overflow).toBe('')
  })
})
