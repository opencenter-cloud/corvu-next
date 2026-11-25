import { createRoot, createSignal, flush } from 'solid-js'
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
})
