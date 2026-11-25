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
- `@corvu-next/resizable` renormalises the panels that stay when one unmounts, so the sizes
  keep summing to 1: removing one of two equal panels reports `[1]`, not `[0]`.
- `@corvu-next/resizable` places a panel by where its element sits in the document rather
  than by when it registers. Two things went wrong before. A write is staged until the end
  of the frame that made it, so every panel of one frame read the panel list through the
  accessor as it was before the frame — empty — took index 0, and added an entry to a
  controlled `sizes` that already described every panel; the list is now read, and kept
  sorted by document position, from inside its own setter, which is handed the value
  staged earlier in the same frame. And registration order is not the layout: nothing
  guarantees that the panels of one frame register in document order, so the first
  `initialSizes` entry could land on the last panel. A panel whose size comes from
  `initialSizes` now follows the sorted list — each registration re-derives those panels'
  entries from their place in the list as it then stands — so a panel registering in front
  of others moves them to their own entries. A panel stops following the moment anything
  else sets sizes: `resize`, `collapse`, `expand`, a drag, a key, or the consumer's own
  `setSizes`. It is the move that counts, not the number, so a panel put back on exactly
  its entry stays where the consumer left it. A full layout stays full: sizes are kept to
  six decimal places, so a layout of n panels is full when its total is within
  n × 10⁻⁶ of 1 — three thirds are stored as `0.333333` and sum to `0.999999` — and a
  panel joining one takes its room from the panels there. Nothing is written back over the
  shares they gave up. A size the layout could give as it was asked for comes back exactly
  as asked, to those six places: the panel being resized, collapsed or expanded, the panel
  joining the layout at its own `initialSize`, its entry or the default, and a controlled
  `sizes`. A request the other panels' bounds cut short is not a size anyone was given, so
  that panel holds a derived size like any other. A size is reported only where its panel
  may rest: inside `minSize` and `maxSize`, rounded inward — one sitting on `minSize`
  rounds up to the next six-place size at or above it, one on `maxSize` rounds down, so
  `minSize={1/7}` is reported as `0.142858`, never `0.142857`. A panel that can collapse
  rests either on its collapsed size or anywhere from its minimum to its maximum, never in
  the gap between them: a collapsed panel is pinned at its collapsed size as the layout
  stores it, and an open one has its minimum and maximum like any other panel. Whether a
  panel is collapsed is read through that same rounding everywhere — `collapsed`, the
  collapse, expand and keyboard paths, and the distribution itself — so a
  `collapsedSize={1/11}` still reads as collapsed. What the rounding leaves over is carried
  by the largest panel the write derived that has room for it where its panel may rest, and
  on a tie by the first of them. A drag asks for no size in particular, so every panel it
  moves is derived and the largest with room carries it; a lone panel resizing itself
  derives nothing, and nothing is carried. The request and the bounds come before the
  total: nothing is carried when the request was given exactly and every derived panel is
  pinned in the direction the remainder would move it, and the layout is then handed on up
  to n × 10⁻⁶ from 1, which still counts as full, and the next write with room in it brings
  the total back. Bounds of the consumer's that cannot all hold together — three panels
  that may not be smaller than two fifths, or maximums that cannot take the size an
  unmounting panel gives up — win over the total, and the layout they describe is what is
  reported. Every write of a full layout goes through that one step: a panel joining a full
  layout takes an equal share from the panels there, and when their bounds will not give
  that share it takes what is left instead, like a resize the bounds cut short; the panels
  that stay when one unmounts share what it gave up the same way, so a collapsed panel is
  not opened by a share it never asked for and no panel passes its maximum. A panel joining
  a layout that is not full yet is only rounded, into the sizes its own panel may rest at.
  Sizes are fractions of the root and stay what they are when the root is resized; a
  `minSize` or `maxSize` given in pixels is resolved against the root and held at the next
  write, not the moment the root changes size. A layout written with a number of panels
  that does not match its number of sizes throws, naming both.
- `createControllableSignal` leaves composition of functional writes to Solid's own setter,
  which applies them to the value staged earlier in the same frame, and keeps its own ledger
  only for the controlled path, where nothing is written locally. `@corvu-next/utils` and
  `@corvu-next/resizable` carry the first unit tests in the repository, run by `pnpm test`.
