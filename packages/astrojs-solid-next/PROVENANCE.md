# Provenance

This package is a fork of `@astrojs/solid-js@7.0.1` from the Astro monorepo.

- **Upstream repo:** https://github.com/withastro/astro
- **Upstream path:** `packages/integrations/solid/`
- **Upstream version:** `@astrojs/solid-js@7.0.1`
- **Import date:** 2026-07-16
- **Import commit:** `withastro/astro@main` (latest as of import date)

## Modifications from upstream

1. **Package name:** `@astrojs/solid-js` → `@corvu-next/astrojs-solid-next`
2. **Solid version target:** `solid-js@^1.9.13` → `solid-js@^2.0.0-beta.19`
3. **Import paths:** `solid-js/web` → `@solidjs/web`; `solid-js/store` → `solid-js`
4. **Component renames:** `Suspense` → `Loading` (Solid 2 API)
5. **Vite plugin:** `vite-plugin-solid@^2.11.12` → `^3.0.0-next.11`
6. **No build step:** Exports source `.ts` directly for workspace consumption (no dist/)
7. **Dropped devtools integration:** Not needed for docs site; can be re-added later
8. **Dropped deprecated `getContainerRenderer` re-export warning:** Single clean export
9. **Store API:** `reconcile()` replaced with draft-based store mutation (Solid 2 store API)

## Sync policy

No ongoing sync with upstream. One-time import. Cherry-pick only if a specific upstream fix becomes valuable.
