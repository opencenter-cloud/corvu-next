import { afterEach, describe, expect, test } from 'vitest'
import { flush } from 'solid-js'
import type { JSX } from '@solidjs/web'
import OtpField from '@src/index'
import { render } from '@solidjs/web'

let dispose: (() => void) | null = null
let container: HTMLElement | null = null

const mount = (component: () => JSX.Element) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(component, container)
  flush()
  return container
}

afterEach(() => {
  dispose?.()
  container?.remove()
  dispose = null
  container = null
})

describe('OtpField.Input', () => {
  /**
   * Focusing the field syncs the selection, and the sync asks whether the
   * field is focused. The handler has just written that, and a write is
   * staged until the end of the frame, so reading it back out of the signal
   * answers `false` and the field comes up with no active slot — no caret
   * for the user to type at. The handler hands its own answer on instead.
   */
  test('focusing the field makes the first slot active', () => {
    let fieldProps: { activeSlots: number[] } | null = null

    mount(() => (
      <OtpField maxLength={4}>
        {(props) => {
          fieldProps = props
          return <OtpField.Input />
        }}
      </OtpField>
    ))

    const input = document.querySelector('input')!
    input.focus()
    flush()

    expect(document.activeElement).toBe(input)
    expect(fieldProps!.activeSlots).toEqual([0])
  })

  test('blurring the field leaves no slot active', () => {
    let fieldProps: { activeSlots: number[] } | null = null

    mount(() => (
      <OtpField maxLength={4}>
        {(props) => {
          fieldProps = props
          return <OtpField.Input />
        }}
      </OtpField>
    ))

    const input = document.querySelector('input')!
    input.focus()
    flush()
    expect(fieldProps!.activeSlots).toEqual([0])

    input.blur()
    flush()

    expect(fieldProps!.activeSlots).toEqual([])
  })
})
