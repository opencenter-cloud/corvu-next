# @corvu-next/prevent-scroll

Scroll prevention utility for SolidJS 2.0 — locks background scrolling for modals and overlays.

> **Note:** This is the Solid 2.0 fork of [solid-prevent-scroll](https://corvu.dev/docs/utilities/prevent-scroll). It targets `solid-js@2.0.0-beta.17`.

## Features

- Prevents background scroll when modals/overlays are open
- Preserves scroll position
- Handles iOS Safari scroll lock
- Nestable — multiple layers can each request scroll lock
- Headless — doesn't create extra DOM elements

## Installation

```bash
pnpm add @corvu-next/prevent-scroll
```

## Usage

```tsx
import createPreventScroll from '@corvu-next/prevent-scroll'

createPreventScroll({ enabled: () => isModalOpen() })
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
