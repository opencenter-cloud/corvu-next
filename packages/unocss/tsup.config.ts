import { defineConfig } from 'tsup'

export default defineConfig({
  target: 'esnext',
  platform: 'browser',
  format: 'esm',
  clean: true,
  dts: true,
  entry: { index: 'src/index.ts' },
  outDir: 'dist/',
  treeshake: { preset: 'smallest' },
  replaceNodeEnv: true,
  esbuildOptions(options) {
    options.chunkNames = '[name]/[hash]'
    options.drop = ['console', 'debugger']
  },
})
