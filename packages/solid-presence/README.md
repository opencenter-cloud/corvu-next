# @corvu-next/presence

Presence animation utility for SolidJS 2.0 — mount/unmount with enter/exit animations.

> **Note:** This is the Solid 2.0 fork of [solid-presence](https://corvu.dev/docs/utilities/presence). It targets `solid-js@2.0.0-beta.17`.

## Features

- Mount/unmount elements with CSS or JS animations
- Tracks animation state (entering, present, exiting)
- Integrates with CSS transition/animation events
- Headless — doesn't create extra DOM elements

## Installation

```bash
pnpm add @corvu-next/presence
```

## Usage

```tsx
import createPresence from '@corvu-next/presence'

const presence = createPresence({ show: () => isOpen() })
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
