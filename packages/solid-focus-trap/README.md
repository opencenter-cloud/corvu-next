# @corvu-next/focus-trap

Focus trap utility for SolidJS 2.0 — traps keyboard focus within a container element.

> **Note:** This is the Solid 2.0 fork of [solid-focus-trap](https://corvu.dev/docs/utilities/focus-trap). It targets `solid-js@2.0.0-beta.17`.

## Features

- Traps focus within a container element
- Restores focus on deactivation
- Handles edge cases (initial focus, tab wrapping)
- Headless — doesn't create extra DOM elements

## Installation

```bash
pnpm add @corvu-next/focus-trap
```

## Usage

```tsx
import createFocusTrap from '@corvu-next/focus-trap'

const [containerRef, setContainerRef] = createSignal(null)
createFocusTrap({ element: containerRef, enabled: () => isOpen() })
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
