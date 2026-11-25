import { defineConfig } from 'vitest/config'
import solid from '@solidjs/vite-plugin'

// The Solid plugin compiles JSX, puts the test graph in the client posture
// (DOM codegen, browser export conditions) and inlines `solid-js` and
// `@solidjs/web`, so a test runs against the development build of the
// framework — the one that warns, and the one consumers debug against.
// `vitest.setup.ts` holds that to it: it throws at load if the production
// build resolved, and fails any test Solid raised a diagnostic in.
export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@src': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [/solid-js/, /@solidjs\//, /@corvu-next\//],
      },
    },
  },
})
