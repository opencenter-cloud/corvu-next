import { type DiagnosticEvent, OBSERVE, flush } from 'solid-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import DynamicButton from '@src/dynamic/DynamicButton'
import { attribution } from 'solid-js/attribution'
import { render } from '@solidjs/web'

/**
 * The attribution engine is what a Solid dev server runs (`@solidjs/vite-plugin`
 * prebundles `solid-js/attribution` for `serve`), and it is what raises the
 * feedback diagnostics — `EFFECT_WRITES_OWN_SOURCE` among them. The plain
 * development build carries the hook slot and leaves it empty, so these cases
 * hold the engine open for the file rather than assuming a consumer did.
 */
let release: () => void
beforeAll(() => {
  release = attribution.enable()
})
afterAll(() => release())

/**
 * Renders into a host already in the document and reports what Solid did to it
 * afterwards: every diagnostic raised, and every `type`/`role` write the
 * mounted element saw.
 *
 * An element whose props settle in one flush is fully configured before it is
 * inserted, so its write log is empty. One that measures the mounted node and
 * corrects itself has to write after insertion, and each correction lands here.
 */
const renderWithAttributeLog = (code: () => unknown) => {
  const host = document.createElement('div')
  document.body.appendChild(host)

  const diagnostics: DiagnosticEvent[] = []
  const unsubscribe = OBSERVE!.diagnostics.subscribe((event) => {
    diagnostics.push(event)
  })

  const observer = new MutationObserver(() => {})
  observer.observe(host, {
    attributes: true,
    subtree: true,
    attributeFilter: ['type', 'role'],
  })

  const dispose = render(code as never, host)
  flush()

  const writes = observer.takeRecords().map((record) => {
    const name = record.attributeName as string
    return `${name}=${(record.target as Element).getAttribute(name)}`
  })
  observer.disconnect()
  unsubscribe()

  return {
    element: host.firstElementChild as Element,
    writes,
    codes: diagnostics.map((event) => event.code),
    cleanup: () => {
      dispose()
      host.remove()
    },
  }
}

describe('DynamicButton', () => {
  // The element `Dynamic` renders is known from `as` before it exists, so a
  // non-button `as` must never be handed the native `type` and then have it
  // taken back. Measuring the mounted node instead writes a ref that the very
  // spread effect applying `type` and `role` reads back through the tag-name
  // memo: Solid raises EFFECT_WRITES_OWN_SOURCE, the flush settles in two
  // passes, and the element sits in the document with the pre-measurement
  // markup in between.
  test('a non-button `as` is typed from the prop, in one flush', () => {
    const { element, writes, codes, cleanup } = renderWithAttributeLog(() => (
      <DynamicButton as="div">trigger</DynamicButton>
    ))

    expect(element.tagName.toLowerCase()).toBe('div')
    expect(element.getAttribute('role')).toBe('button')
    expect(element.hasAttribute('type')).toBe(false)
    expect(writes).toEqual([])
    expect(codes).toEqual([])

    cleanup()
  })

  test('the default `as` is a native button, with no role', () => {
    const { element, writes, codes, cleanup } = renderWithAttributeLog(() => (
      <DynamicButton>trigger</DynamicButton>
    ))

    expect(element.tagName.toLowerCase()).toBe('button')
    expect(element.getAttribute('type')).toBe('button')
    expect(element.hasAttribute('role')).toBe(false)
    expect(writes).toEqual([])
    expect(codes).toEqual([])

    cleanup()
  })
})
