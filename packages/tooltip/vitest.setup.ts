/**
 * The vitest setup file of this package, loaded through `setupFiles`.
 *
 * It enforces the two things the test project claims:
 *
 *   1. **The tests run on Solid's development build.** `OBSERVE` is exported
 *      only by the development and observe builds of `solid-js`; under
 *      `@solidjs/vite-plugin` the `development` condition resolves. If a
 *      config ever resolves the production build, this throws at load rather
 *      than letting every diagnostic below go silent.
 *   2. **Any Solid dev diagnostic fails the test that raised it.** Every event
 *      on `OBSERVE.diagnostics` — a strict read, a write from an owned scope,
 *      a cleanup in a forbidden scope, any code — is collected, and `afterEach`
 *      throws with the code, the message, the owner path and the stack it was
 *      raised from. No code is named, so a diagnostic Solid adds is covered
 *      the day it ships.
 */

import { type DiagnosticEvent, OBSERVE } from 'solid-js'
import { afterEach } from 'vitest'

if (OBSERVE === undefined) {
  throw new Error(
    'vitest.setup.ts: solid-js resolved to its PRODUCTION build (OBSERVE is undefined). ' +
      'These tests must run on the development build, the one that carries diagnostics — ' +
      'load @solidjs/vite-plugin in this vitest config and give the project a DOM environment.',
  )
}

/** One diagnostic, with the stack at the moment Solid raised it: `ownerPath`
 *  names the owner, the stack names the line in the code under test. */
type Raised = { event: DiagnosticEvent; stack: string }

let raised: Raised[] = []
OBSERVE.diagnostics.subscribe((event) => {
  raised.push({ event, stack: new Error().stack ?? '' })
})

afterEach(() => {
  if (raised.length === 0) return
  const events = raised
  raised = []
  throw new Error(
    `Solid raised ${events.length} dev diagnostic(s) during this test:\n` +
      events
        .map(
          ({ event, stack }) =>
            `  [${event.code}] ${event.message}` +
            (event.ownerPath ? `\n    at ${event.ownerPath.join(' › ')}` : '') +
            (event.loc ? `\n    (${event.loc})` : '') +
            `\n    raised from:\n${stack.split('\n').slice(1).join('\n')}`,
        )
        .join('\n'),
  )
})
