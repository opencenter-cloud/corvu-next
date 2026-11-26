import { defineConfig } from 'tsup'
import { solidTsupConfig } from '../../tsup.preset'

export default defineConfig(
  solidTsupConfig([
    'src/index.ts',
    'src/components/*.tsx',
    'src/create/*.ts',
    'src/dom/index.ts',
    'src/dynamic/index.ts',
    'src/floating/index.ts',
    'src/reactivity/index.ts',
    'src/scroll/index.ts',
    // The glob entries above would otherwise make an entry point of every
    // test file sitting next to the module it covers.
    '!src/**/*.test.ts',
  ]),
)
