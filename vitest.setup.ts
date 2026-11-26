/**
 * The vitest setup file of every test project in this repository, loaded
 * through each package's `setupFiles`.
 *
 * It enforces the three things the test projects claim:
 *
 *   1. **The tests run on Solid's development build.** `OBSERVE` is exported
 *      only by the development and observe builds of `solid-js`; under
 *      `@solidjs/vite-plugin` the `development` condition resolves. If a
 *      config ever resolves the production build, this throws at load rather
 *      than letting every diagnostic below go silent.
 *   2. **The attribution engine is on, with the options a dev server uses.**
 *      Solid's feedback diagnostics — `EFFECT_WRITES_OWN_SOURCE` and its
 *      siblings — are raised only while `solid-js/attribution` is enabled,
 *      which `@solidjs/vite-plugin` does for `serve`. The plain development
 *      build carries the hook slot and leaves it empty, so without this a
 *      whole tier of diagnostics is silent in tests and raised for the first
 *      time on a consumer's dev server.
 *   3. **Any Solid dev diagnostic fails the test that raised it.** Every event
 *      on `OBSERVE.diagnostics` — a strict read, a write from an owned scope,
 *      a cleanup in a forbidden scope, an effect that writes its own source,
 *      any code — is collected, and `afterEach` throws with the code, the
 *      message, the owner path and the stack it was raised from. No code is
 *      named, so a diagnostic Solid adds is covered the day it ships.
 */

import { type DiagnosticEvent, OBSERVE } from 'solid-js'
import { afterAll, afterEach } from 'vitest'
import { attribution } from 'solid-js/attribution'

if (OBSERVE === undefined) {
  throw new Error(
    'vitest.setup.ts: solid-js resolved to its PRODUCTION build (OBSERVE is undefined). ' +
      'These tests must run on the development build, the one that carries diagnostics — ' +
      'load @solidjs/vite-plugin in this vitest config and give the project a DOM environment.',
  )
}

/** The engine with the checks that judge the GRAPH on, and every check that
 *  judges the CLOCK of the machine that ran it off — the set kolu's
 *  `@kolu/solid-test-setup` installs, so a finding is the same finding in
 *  either repository. On: every diagnostic a dev server raises, plus the
 *  three count checks — `wideDeps` (200 sources on one scope),
 *  `unstableMemos` (four consecutive equal-but-new memo outputs) and
 *  `fanOut` (250 subscribers). `UNSTABLE_MEMO_OUTPUT` is the one these
 *  packages keep earning: a memo rebuilding an equivalent object re-runs
 *  every subscriber. Off, named key by key because `checks: false` would
 *  take the counts with them: `hotRuns` (120 runs in 1000ms, two codes),
 *  `hotTime` (8ms of self-time), `wastedRecompute` (5 runs, 80% unchanged,
 *  2ms of compute), `holds` (also `UNTRACKED_ASYNC_HANDLER`), `longHolds`,
 *  `waterfalls` and `stackedHolds`. Each of those times a real wait, so on a
 *  loaded box they fail a test for the latency of the machine rather than
 *  for anything in the code. `log: false` is the per-re-run console print
 *  only; every finding still reaches `OBSERVE.diagnostics`, which is what
 *  the `afterEach` below reads. */
const releaseAttribution = attribution.enable({
  log: false,
  hotRuns: false,
  hotTime: false,
  wastedRecompute: false,
  holds: false,
  longHolds: false,
  waterfalls: false,
  stackedHolds: false,
})
afterAll(() => releaseAttribution())

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
            `  [${event.severity}] [${event.code}] ${event.message}` +
            (event.ownerPath ? `\n    at ${event.ownerPath.join(' › ')}` : '') +
            (event.loc ? `\n    (${event.loc})` : '') +
            `\n    raised from:\n${stack.split('\n').slice(1).join('\n')}`,
        )
        .join('\n'),
  )
})
