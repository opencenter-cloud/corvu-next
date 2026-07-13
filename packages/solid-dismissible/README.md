# @corvu-next/dismissible

Dismissible layer utility for SolidJS 2.0 — nestable layers with outside click, escape key, and outside focus strategies.

> **Note:** This is the Solid 2.0 fork of [solid-dismissible](https://corvu.dev/docs/utilities/dismissible). It targets `solid-js@2.0.0-beta.17`.

## Features

- Supports nested layers
- Dismiss on outside pointer down/up, outside focus, or escape key
- Headless — doesn't create extra DOM elements
- Every dismiss strategy can be disabled/customized
- Events can be cancelled
- Compatible with @corvu-next primitives

## Installation

```bash
pnpm add @corvu-next/dismissible
```

## Usage

```tsx
import Dismissible from '@corvu-next/dismissible'

const DialogContent = (props) => {
  const [contentRef, setContentRef] = createSignal(null)

  return (
    <Dismissible
      element={contentRef}
      enabled={props.open()}
      onDismiss={() => props.setOpen(false)}
    >
      <Show when={props.open()}>
        <div ref={setContentRef}>Dialog</div>
      </Show>
    </Dismissible>
  )
}
```

## Further Reading

This package is part of [corvu-next](https://github.com/opencenter-cloud/corvu-next), a collection of unstyled, accessible and customizable UI primitives for SolidJS 2.0.
