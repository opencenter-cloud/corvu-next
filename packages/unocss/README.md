# @corvu-next/unocss

UnoCSS plugin for corvu-next — provides `corvu-open:`, `corvu-closed:`, and other state-based variants.

> **Note:** This is the Solid 2.0 fork of the corvu UnoCSS plugin. It targets `solid-js@2.0.0-beta.17`.

## Installation

```bash
pnpm add -D @corvu-next/unocss
```

## Usage

```ts
// uno.config.ts
import { defineConfig } from 'unocss'
import corvu from '@corvu-next/unocss'

export default defineConfig({
  presets: [corvu()],
})
```

## Available Variants

- `corvu-open:` — matches `data-open` state
- `corvu-closed:` — matches `data-closed` state
- `corvu-expanded:` — matches `data-expanded` state
- `corvu-collapsed:` — matches `data-collapsed` state

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
