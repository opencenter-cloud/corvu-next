import { createRoot, createSignal, flush } from 'solid-js'
import { describe, expect, test, vi } from 'vitest'
import createFloating from '@src/create/floating'

/**
 * The placement and the strategy decide where the floating element is put, and
 * a consumer may hand either of them over as a signal. They are read in the
 * effect's compute phase: read from `autoUpdate`'s callback instead, the first
 * call lands inside the apply phase, where Solid raises
 * `STRICT_READ_UNTRACKED` (`vitest.setup.ts` fails the test on any diagnostic),
 * and the position would never follow a later placement.
 */
describe('createFloating', () => {
  const mount = () => {
    const reference = document.createElement('div')
    const floating = document.createElement('div')
    document.body.append(reference, floating)
    return { reference, floating }
  }

  test('a reactive placement is read where it can be tracked', async () => {
    const { reference, floating } = mount()
    const [placement, setPlacement] = createSignal<'top' | 'bottom'>('bottom')

    const { state, dispose } = createRoot((dispose) => {
      const state = createFloating({ reference, floating, placement })
      return { state, dispose }
    })
    flush()
    await vi.waitFor(() => expect(state().placement).toBe('bottom'))

    setPlacement('top')
    flush()
    await vi.waitFor(() => expect(state().placement).toBe('top'))

    dispose()
    reference.remove()
    floating.remove()
  })

  test('a reactive strategy is read where it can be tracked', async () => {
    const { reference, floating } = mount()
    const [strategy, setStrategy] = createSignal<'absolute' | 'fixed'>(
      'absolute',
    )

    const { state, dispose } = createRoot((dispose) => {
      const state = createFloating({ reference, floating, strategy })
      return { state, dispose }
    })
    flush()
    await vi.waitFor(() => expect(state().placement).toBe('bottom'))

    setStrategy('fixed')
    flush()
    await vi.waitFor(() => expect(state().placement).toBe('bottom'))

    dispose()
    reference.remove()
    floating.remove()
  })
})
