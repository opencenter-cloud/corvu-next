import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  target: 'esnext',
  platform: 'browser',
  clean: true,
  dts: true,
  outDir: 'dist/',
  treeshake: { preset: 'smallest' },
})
