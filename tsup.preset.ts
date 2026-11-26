import type { Options } from 'tsup'
import { transform } from '@solidjs/compiler'

type TsupPlugin = NonNullable<Options['plugins']>[number]

/**
 * Compiles the JSX that esbuild preserved in the bundled `.js` chunks with
 * Solid's native compiler — the same compiler `@solidjs/vite-plugin` runs, so
 * the prebuilt `dist/index.js` and the `dist/index.jsx` that a consumer's own
 * bundler compiles go through one code generator.
 *
 * tsup runs plugin `renderChunk` hooks before its tree-shaking pass, so the
 * compiled output (and the pure-call annotations the compiler emits) still
 * reaches rollup.
 */
const solidCompiler = (): TsupPlugin => ({
  name: 'solid-compiler',
  renderChunk(code, chunk) {
    // The preserved-JSX build writes `.jsx`; leave those chunks as authored.
    if (!chunk.path.endsWith('.js')) return
    // `filename` is deliberately unset: it only labels diagnostics and dev
    // source names, while the compiler picks its syntax frontend from the
    // extension — and a bundled chunk is already named `.js`.
    return { code: transform(code, { generate: 'dom' }).code }
  },
})

const generateConfig = (entry: string[], jsx: boolean): Options => ({
  target: 'esnext',
  platform: 'browser',
  format: 'esm',
  clean: true,
  dts: !jsx,
  entry,
  outDir: 'dist/',
  treeshake: { preset: 'smallest' },
  replaceNodeEnv: true,
  esbuildOptions(options) {
    options.jsx = 'preserve'
    options.chunkNames = '[name]/[hash]'
    options.drop = ['console', 'debugger']
  },
  outExtension() {
    return jsx ? { js: '.jsx' } : {}
  },
  plugins: jsx ? [] : [solidCompiler()],
})

/**
 * The two builds every Solid package in this repository ships: `dist/*.js`
 * compiled to DOM instructions, and `dist/*.jsx` with the JSX preserved for
 * consumers that resolve the `solid` export condition and compile it
 * themselves. Types are emitted once, alongside the compiled build.
 */
export const solidTsupConfig = (entry: string[]): Options[] => [
  generateConfig(entry, false),
  generateConfig(entry, true),
]
