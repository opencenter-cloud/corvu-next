import { defineConfig } from 'tsup'
import { solidTsupConfig } from '../../tsup.preset'

export default defineConfig(
  solidTsupConfig([
    'src/accordion.ts',
    'src/calendar.ts',
    'src/dialog.ts',
    'src/disclosure.ts',
    'src/drawer.ts',
    'src/otp-field.ts',
    'src/popover.ts',
    'src/resizable.ts',
    'src/tooltip.ts',
  ]),
)
