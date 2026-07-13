# @corvu-next/persistent

Persistent rendering utility for SolidJS 2.0 — keeps components in the DOM when hidden for faster show/hide transitions.

> **Note:** This is the Solid 2.0 fork of [solid-persistent](https://corvu.dev/docs/utilities/persistent). It targets `solid-js@2.0.0-beta.17`.

## Features

- Keeps component subtree in the DOM when hidden
- Avoids re-mount cost on repeated show/hide
- Works with any conditional rendering pattern

## Installation

```bash
pnpm add @corvu-next/persistent
```

## Usage

```tsx
import Persistent from '@corvu-next/persistent'

<Persistent when={isOpen()}>
  <div>This stays in the DOM even when hidden</div>
</Persistent>
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
