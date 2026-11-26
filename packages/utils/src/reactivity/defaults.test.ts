import { createRoot, createSignal, flush } from 'solid-js'
import { describe, expect, test } from 'vitest'
import mergeDefaults from '@src/reactivity/defaults'

describe('mergeDefaults', () => {
  test('a prop passed as undefined takes the default', () => {
    const props: { size?: number; label?: string } = { label: 'hi' }
    const merged = mergeDefaults({ size: 16 }, props)

    expect(merged.size).toBe(16)
    expect(merged.label).toBe('hi')
  })

  test('a value the consumer passed wins, false and 0 included', () => {
    const merged = mergeDefaults(
      { enabled: true, offset: 8, fallback: 'default' as string | null },
      { enabled: false, offset: 0, fallback: null },
    )

    expect(merged.enabled).toBe(false)
    expect(merged.offset).toBe(0)
    // `null` is a value; only `undefined` means "use the default".
    expect(merged.fallback).toBe(null)
  })

  test('a prop that becomes defined, and undefined again, is followed', () => {
    const [size, setSize] = createSignal<number | undefined>(undefined)
    const merged = createRoot(() =>
      mergeDefaults(
        { size: 16 },
        {
          get size() {
            return size()
          },
        },
      ),
    )

    expect(merged.size).toBe(16)

    setSize(24)
    flush()
    expect(merged.size).toBe(24)

    setSize(undefined)
    flush()
    expect(merged.size).toBe(16)
  })

  test('a default that is a function is handed on as the value it is', () => {
    const derived = () => 'derived'
    const merged = mergeDefaults({ value: derived }, {})

    // These packages use a thunk as a default whose value depends on another
    // prop, and resolve it with `access`. It is a value like any other here.
    expect(merged.value).toBe(derived)
  })

  test('the keys of both sources are enumerable, defaults included', () => {
    const merged = mergeDefaults({ size: 16 }, { label: 'hi' })

    expect(Object.keys(merged).sort()).toEqual(['label', 'size'])
    expect({ ...merged }).toEqual({ size: 16, label: 'hi' })
  })
})
