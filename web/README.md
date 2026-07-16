# @corvu-next/web

> ⚠️ **Local-only reference site — not deployed.**

## Overview

Validates that all `@corvu-next/*` packages work in a real Astro docs application. Documents 9 primitives and 8 utilities with live examples and typedoc-generated API reference.

- **Framework:** Astro 7, `@corvu-next/astrojs-solid-next`, Tailwind CSS 4
- **Runtime:** solid-js@2.0.0-beta.19, @solidjs/web@2.0.0-beta.19
- **Search:** Pagefind (production builds only)
- **Provenance:** Imported from `corvudev/corvu@ff79bca9`, ported to Solid 2

## Commands

```bash
pnpm --filter @corvu-next/web dev       # Dev server at localhost:4321
pnpm --filter @corvu-next/web build     # Astro build + Pagefind indexing
pnpm --filter @corvu-next/web preview   # Serve production build locally
```

`pnpm turbo typedoc` must run before build to generate `api.json` files consumed by the docs pages.

## Sunset

This site becomes obsolete when upstream [corvudev/corvu](https://github.com/corvudev/corvu) ships native Solid 2 support. At that point, delete `web/` and migrate any unique content back upstream.
