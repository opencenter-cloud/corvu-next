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
  ]),
)
