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
  keep summing to 1 within their bounds: removing one of two equal panels reports `[1]`,
  not `[0]`.
- `@corvu-next/resizable` places a panel by where its element sits in the document rather
  than by when it registers. A write is staged until the end of the frame that made it, so
  every panel of one frame used to read the panel list through the accessor as it was
  before the frame — empty — take index 0, and add an entry to a controlled `sizes` that
  already described every panel. The list is now read, and kept sorted by document
  position, from inside its own setter, which is handed the value staged earlier in the
  same frame. Registration order is not the layout either: nothing guarantees that the
  panels of one frame register in document order, so the first `initialSizes` entry could
  land on the last panel. A panel whose size comes from `initialSizes` now follows the
  sorted list, and each registration re-derives those panels' entries from their place in
  the list as it then stands, so a panel registering in front of others moves them to their
  own entries. A panel stops following the moment anything else sets sizes: `resize`,
  `collapse`, `expand`, a drag, a key, or the consumer's own `setSizes`. It is the move
  that counts, not the number, so a panel put back on exactly its entry stays where the
  consumer left it.
- `@corvu-next/resizable` writes every layout one way, and this is that way:
  - **Exact sizes.** A size the layout can give as it was asked for comes back exactly, to
    the six decimal places sizes are kept at: the panel being resized, collapsed or
    expanded, and a panel joining at its own `initialSize`, its entry or the default. A
    request the other panels' bounds cut short is not a size anyone was given, so that
    panel's size is derived like any other.
  - **Bounds, at every write.** A size is reported only where its panel may rest: inside
    `minSize` and `maxSize`, rounded inward, so `minSize={1/7}` comes back as `0.142858`
    and never `0.142857`. A panel that can collapse rests either on its collapsed size or
    anywhere from its minimum to its maximum, never in the gap between them. Sizes are
    fractions of the root and stay what they are when the root is resized; a `minSize` or
    `maxSize` given in pixels is resolved against the root and held at the next write, not
    the moment the root changes size.
  - **Collapsed.** Whether a panel is collapsed is read through the same rounding the write
    applies, everywhere it is asked — `collapsed`, the collapse, expand and keyboard paths,
    and the distribution itself — so a `collapsedSize={1/11}` still reads as collapsed.
  - **What the rounding leaves over** is carried by the panels the write derived, the
    largest of them first and on a tie the first of them, each taking as much of it as its
    own bounds allow and passing the rest to the next. A drag or a key asks for no size in
    particular, so every panel it moves is derived; a lone panel resizing itself derives
    nothing, and nothing is carried.
  - **Where bounds and the total disagree, the bounds win.** Three panels that may not be
    smaller than two fifths all sit at two fifths and the layout is reported at 1.2;
    maximums that cannot take the size an unmounting panel gives up leave those panels at
    their maximums and the layout short of the root; a panel joining a layout with less
    room than it asked for takes the room that is left, and its own minimum over that, with
    the panels already there giving the shortfall where their own bounds allow.
    Apart from those, and rounding of at most n × 10⁻⁶, a layout sums to 1, and the next
    write with room in it brings the total back.
  - **A resize fills a layout that is not full.** It moves size between the panels and the
    write then shares out whatever they are away from the root, so a resize, drag or key
    takes the room a panel still to mount would have had. That is how corvu behaved before
    this port too; it is written down here now.
  - **A frame's first layout follows the document, not the order it settled in.** While
    nothing has arranged the layout — no resize, collapse, expand, drag, key, consumer
    `setSizes` or unmount — each registration lays it out again from the panels in document
    order, applying corvu's own join rule to each in turn: its `initialSize`, else its
    `initialSizes` entry, else the default half, with the panels already there giving an
    equal share of it when they fill the root. That is the layout corvu produced on Solid 1,
    where panels registered in creation order; on Solid 2 they settle in reverse, which
    would otherwise flip it. Nothing about the defaults or the rule changes. Once something
    has arranged the layout, a panel mounting later joins it as it stands, and one panel
    joining has no order to depend on.
  - **Every write goes through that step:** a resize, a collapse, an expand, a drag, a key,
    a panel joining the layout and the panels that stay when one unmounts, a controlled
    root's own resizes and drags included. A panel joining a layout that is not full is the
    exception: no room is shared out, and the entries the consumer gave are rounded into the
    sizes their panels may rest at — which covers a rejoin after an unmount left the layout
    short as well as the first frame mounting. Where the layout they describe does not fit
    the root, a panel its own bound raised holds at that bound and every other panel shares
    what is over, within its own bounds: no panel is singled out for being the one that
    registered last, so the layout is the same whichever of a frame's panels that was. A layout written
    with a number of panels that does not match its number of sizes throws, naming both.
- `createControllableSignal` leaves composition of functional writes to Solid's own setter,
  which applies them to the value staged earlier in the same frame, and keeps its own ledger
  only for the controlled path, where nothing is written locally. `@corvu-next/utils` and
  `@corvu-next/resizable` carry the first unit tests in the repository, run by `pnpm test`.
