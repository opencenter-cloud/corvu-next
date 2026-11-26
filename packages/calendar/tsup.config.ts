import { defineConfig } from 'tsup'
import { solidTsupConfig } from '../../tsup.preset'

export default defineConfig(solidTsupConfig(['src/index.ts']))
