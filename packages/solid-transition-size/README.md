# @corvu-next/transition-size

Animated size transition utility for SolidJS 2.0 — smoothly animates height/width changes.

> **Note:** This is the Solid 2.0 fork of [solid-transition-size](https://corvu.dev/docs/utilities/transition-size). It targets `solid-js@2.0.0-beta.17`.

## Features

- Animates height and/or width changes
- Uses CSS transitions for smooth animation
- Works with dynamic content
- Headless — doesn't create extra DOM elements

## Installation

```bash
pnpm add @corvu-next/transition-size
```

## Usage

```tsx
import TransitionSize from '@corvu-next/transition-size'

<TransitionSize>
  <div>{dynamicContent()}</div>
</TransitionSize>
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
