# @corvu-next Changelog

## Provenance

This is a Solid 2 fork of the [corvudev/corvu](https://github.com/corvudev/corvu) monorepo,
maintained separately because upstream is dormant (last release May 2025, last commit Aug 2025).

Base commit: `ff79bca96ead89a703637c0738191e20e1ffa67d` (upstream `main`)

Note: upstream has a stalled `features/solid-v2` branch (last commit Feb 14, 2025) that
targeted `2.0.0-experimental.1`. That branch's API assumptions (`mergeProps` from
`@solidjs/web`) no longer match beta.15 (`merge` from `solid-js`), so this fork starts
fresh from `main` rather than rebasing the stalled branch.

Original package versions this fork is derived from:

| @corvu-next package        | Upstream package          | Upstream version |
|----------------------------|---------------------------|------------------|
| @corvu-next/utils          | @corvu/utils              | 0.4.2            |
| @corvu-next/presence       | solid-presence            | 0.2.0            |
| @corvu-next/prevent-scroll | solid-prevent-scroll      | 0.1.10           |
| @corvu-next/focus-trap     | solid-focus-trap          | 0.1.7            |
| @corvu-next/dismissible    | solid-dismissible         | 0.1.1            |
| @corvu-next/list           | solid-list                | 0.1.x            |

## 0.1.0 — 2026-07-02 (initial fork)

Ported all packages to Solid 2.0.0-beta.15:

- Split-phase `createEffect` (compute + apply phases)
- Return cleanup functions from apply phase (replacing `onCleanup`)
- `mergeProps` → `merge`, `splitProps` → `omit`
- `solid-js/web` imports → `@solidjs/web` (`Portal`, `Dynamic`, `render`, `isServer`)
- JSX types (`JSX`, `ComponentProps`) imported from `@solidjs/web`
- `tsconfig.json` `jsxImportSource` set to `@solidjs/web`
- `createEffect(fn, initialValue)` rewritten as `createEffect((prev = initialValue) => fn, applyFn)`
  using default parameter pattern

No behavioral or API changes to the primitives themselves — same options, same return shapes.

## Unreleased — stable Solid 2.0.3

All packages now target the stable Solid 2 release line instead of `2.0.0-beta.19`.

- `solid-js` and `@solidjs/web` peer ranges are `^2.0.0`; the repository develops and builds
  against `2.0.3`. No prerelease of Solid, its compiler or its Vite plugin is left anywhere in
  the dependency tree.
- Published packages reference each other through the workspace, so a release can no longer
  ship a package that depends on an older version of its own siblings.
- `dist/index.js` is compiled by `@solidjs/compiler` (Solid 2's own compiler, also used by
  `@solidjs/vite-plugin`) instead of the Solid 1 Babel preset that `esbuild-plugin-solid`
  pulled in. Package output is unchanged: `dist/index.js` (compiled), `dist/index.jsx`
  (JSX preserved, served through the `solid` export condition) and `dist/index.d.ts`.
- The Astro integration and the example app moved from `vite-plugin-solid` to its successor
  `@solidjs/vite-plugin` 3.0.1, which requires Vite 8 or 9 and Node 22.12 or newer.
- Server rendering in the Astro integration uses `renderToStream`, as stable Solid 2 removed
  `renderToStringAsync`.
- `@corvu-next/transition-size` no longer throws when the observed element disappears while a
  size transition is running.
