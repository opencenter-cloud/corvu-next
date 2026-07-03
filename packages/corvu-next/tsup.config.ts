import { defineConfig } from 'tsup'
import type { Options } from 'tsup'
import { solidPlugin } from 'esbuild-plugin-solid'

function generateConfig(format: 'esm' | 'cjs', jsx: boolean): Options {
  return {
    target: 'esnext',
    platform: 'browser',
    format,
    clean: true,
    dts: format === 'esm' && !jsx,
    entry: [
      'src/accordion.ts',
      'src/calendar.ts',
      'src/dialog.ts',
      'src/disclosure.ts',
      'src/drawer.ts',
      'src/otp-field.ts',
      'src/popover.ts',
      'src/resizable.ts',
      'src/tooltip.ts',
    ],
    outDir: 'dist/',
    treeshake: { preset: 'smallest' },
    replaceNodeEnv: true,
    esbuildOptions(options) {
      if (jsx) {
        options.jsx = 'preserve'
      }
      options.chunkNames = '[name]/[hash]'
      options.drop = ['console', 'debugger']
    },
    outExtension() {
      if (jsx) {
        return { js: '.jsx' }
      } else {
        return {}
      }
    },
    esbuildPlugins: !jsx ? [solidPlugin({ solid: { generate: 'dom' } })] : [],
  }
}

export default defineConfig([
  generateConfig('esm', false),
  generateConfig('esm', true),
])
