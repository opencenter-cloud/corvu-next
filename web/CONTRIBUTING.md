# Docs Site Smoke Test

> **Purpose:** For contributors, describes how to verify the docs site renders correctly after changes.

## Prerequisites

- pnpm 10 installed
- Dependencies installed at monorepo root: `pnpm install`
- API docs generated: `pnpm turbo typedoc`

## Start Dev Server

```bash
pnpm --filter @corvu-next/web dev
```

Opens at `http://localhost:4321`.

## Pages to Check

| Page | URL |
|------|-----|
| Home | `/` |
| Docs index | `/docs/` |
| Primitive (Dialog) | `/docs/primitives/dialog/` |
| Utility (solid-presence) | `/docs/utilities/solid-presence/` |

## What to Verify

For each page:

1. Page renders without blank sections or layout breaks.
2. Browser console shows zero errors (open DevTools → Console).
3. Search dialog opens with `Ctrl+K` / `Cmd+K` (dev mode shows empty results — this is expected; Pagefind indexes only production builds).
4. API reference section shows typed props tables (e.g., Dialog Root lists `open`, `onOpenChange`, `modal`).

## Production Build

```bash
pnpm --filter @corvu-next/web build
pnpm --filter @corvu-next/web preview
```

Opens at `http://localhost:4321`. Verify:

1. All pages from the table above return HTTP 200.
2. Search dialog returns results for "dialog", "accordion", "presence".
3. No console errors.

## Known Limitations

- **Drawer Root props missing:** The typedoc resolver skips `Drawer.Root` because it re-exports `Dialog.Root` with extended generics. Props are documented inline instead.
- **FloatingOptions / FloatingState:** These appear as `object` in the API tables. They are complex mapped types that typedoc cannot resolve to individual properties.
