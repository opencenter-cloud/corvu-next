---
id: corvu-next-docs-migration-plan
title: "Corvu-next Docs Site Migration to Solid 2"
sidebar_label: Docs Migration Plan
description: Plan to migrate upstream corvu.dev's Astro docs site into the corvu-next fork, targeting solid-js@^2.0.0-beta.17.
doc_type: reference
audience: "corvu-next fork maintainers"
tags: [corvu, solid2, migration, astro, docs, pagefind, typedoc]
---

> **Purpose:** For corvu-next fork maintainers, defines the 7-phase plan to migrate upstream `corvudev/corvu`'s `web/` Astro documentation site into `corvu-next/web/`, targeting `solid-js@^2.0.0-beta.17`, using a forked `@astrojs/solid-js` integration and the fork's `@corvu-next/*` packages.

## Overview

Upstream corvu's `web/` is an Astro 5 documentation site built on `@astrojs/solid-js@^5.1.0`. That integration currently declares `solid-js@^1.9.13` as its peer and depends on `vite-plugin-solid@^2.11.12` — a Solid 1 line. Adopting Solid 2 requires forking the integration alongside the docs site.

Scope is **local-only reference site**: `pnpm dev:web` renders every upstream page against `@corvu-next/*` packages, `astro build` produces a working static output, but the site is not deployed publicly. The migration exists to validate that `@corvu-next/*` packages work end-to-end and to give contributors a docs-equivalent reference during the fork's lifetime.

## Decisions

| # | Decision | Choice |
|--:|----------|--------|
| 1 | Scope | Local-only reference site inside the fork repo. No public deploy. |
| 2 | Framework | Fork `@astrojs/solid-js`; target `solid-js@^2.0.0-beta.17`. |
| 3 | Packaging | Private workspace package `packages/astrojs-solid-next/`, name `@corvu-next/astrojs-solid-next`. |
| 4 | Import policy | Full one-time copy from `corvudev/corvu@ff79bca9` and `withastro/astro@main`. No ongoing sync. `PROVENANCE.md` in each imported dir. |
| 5 | Success criteria | Full runtime parity. All pages render, zero runtime warnings, zero console errors, `astro build` clean, `astro check` clean, Pagefind Search works, API reference generates. |
| 6 | TSX migration | Hand-port per component; narrow mechanical pre-pass for pure renames only. |
| 7 | API reference | Port typedoc pipeline verbatim; retarget `Typedoc` map keys to `@corvu-next/*`. |
| 8 | Search | Pagefind static build-time index; rewrite `Search.tsx` fetch effect only. |
| 9 | CI | `astro check` + `pnpm build` on PRs touching relevant paths; manual smoke checklist in `web/CONTRIBUTING.md`. |
| 10 | Phasing | 7 phases by concern, one PR per phase. |
| 11 | Sunset | Hard sunset on any trigger; preservation git tag `docs-final-YYYY-MM-DD`; single deletion PR. |
| 12 | Plan location | `corvu/docs/DOCS-MIGRATION-PLAN.md` (this file), colocated with the code. |

## Phase 1 — `packages/astrojs-solid-next/`

**Goal:** A private workspace package that renders Solid 2 components inside an Astro 5 site.

**Files created:**
- `packages/astrojs-solid-next/package.json`
- `packages/astrojs-solid-next/tsconfig.json`
- `packages/astrojs-solid-next/src/**` (mirrors upstream `withastro/astro@main` at `packages/integrations/solid/src/**`)
- `packages/astrojs-solid-next/PROVENANCE.md` (records source commit hash)

**Patches to apply on the imported source:**
- `package.json`:
  - `"name": "@corvu-next/astrojs-solid-next"`, `"private": true`, `"version": "0.0.0"`.
  - `peerDependencies.solid-js: "^2.0.0-beta.17"`.
  - `dependencies.vite-plugin-solid: "^3.0.0-next.5"` (was `^2.11.12`).
  - `devDependencies.solid-js: "^2.0.0-beta.17"` (was `^1.9.13`).
  - Drop the `"exports"` object; workspace consumer imports source directly (no dist build).
  - Drop `astro-scripts` build/dev scripts; add a placeholder `"lint"` if needed.
- `src/**/*.ts` and `src/**/*.tsx`:
  - Rewrite every `from 'solid-js/web'` → `from '@solidjs/web'`.
  - Rewrite every `from 'solid-js'` imports remain, but audit `renderToString`, `hydrate`, `Hydration`, `SharedConfig` usage against Solid 2's `@solidjs/web` exports.
  - Any `mergeProps`/`splitProps` internal usage → `merge`/`omit`.
  - `createComponent` call sites — Solid 2 signature check; likely unchanged but confirm.

**Verification:**
- `pnpm --filter @corvu-next/astrojs-solid-next tsc --noEmit` (zero errors).
- Scratch Astro app in `packages/astrojs-solid-next/example/` (or reuse `dev-solid2/`) that renders `<Counter client:load />` with `createSignal` + increment button; boot with `astro dev`, verify counter works.
- SSR check: `astro build` produces HTML with the initial signal value pre-rendered; `hydrate` boots the reactive graph without console warnings.

**Success:** package compiles, hello-world Solid 2 component renders under Astro and hydrates cleanly.

## Phase 2 — `web/` boot skeleton

**Goal:** `corvu-next/web/` boots to a blank layout with topbar and sidebar shells, no runtime errors, no content.

**Files created:**
- `web/**` imported verbatim from `corvudev/corvu@ff79bca9`.
- `web/PROVENANCE.md` (records source commit).
- Root `pnpm-workspace.yaml` already globs `packages/*`; add `web` to workspaces if not covered.

**Patches to apply:**
- `web/package.json`:
  - `"name": "@corvu-next/web"`, `"private": true`.
  - Replace `"@astrojs/solid-js": "^5.1.0"` with `"@corvu-next/astrojs-solid-next": "workspace:*"`.
  - Replace `"@corvu/accordion": "workspace:*"` etc. with `"@corvu-next/accordion": "workspace:*"` etc.
  - Replace `"solid-list": "workspace:*"` → `"@corvu-next/solid-list": "workspace:*"`; same for `solid-persistent`.
  - `"solid-js": "^2.0.0-beta.17"` (was `^1.9.8`).
  - Add `"@solidjs/web": "^2.0.0-beta.17"` — required as a direct peer by `@solid-primitives/storage@next` and consistent with our `@corvu-next/*` packages.
  - Bump `"@solid-primitives/storage"` from `^4.3.3` to `^5.0.0-next.0` (published under the `next` dist-tag; peer `solid-js: ^2.0.0-beta.15`, satisfied by beta.17). API surface preserved: `makePersisted` and every other Solid 1 export still present, so `ThemeSelect.tsx` should port with a version bump alone.
  - Keep everything else at upstream versions.
- `web/astro.config.ts`:
  - `import solid from '@corvu-next/astrojs-solid-next'` (was `'@astrojs/solid-js'`).
  - `site: 'http://localhost:4321'` (was `'https://corvu.dev'`) — no public URL for a local-only site.
  - Remove `sitemap` integration for now; re-enable in Phase 7 if we decide it's worth keeping for validation.
  - Keep MDX, redirects, `preserveScriptOrder: true`, Tailwind Vite plugin.
- `web/tsconfig.json`: add path alias entry for `@corvu-next/*` if TS resolution needs it.
- Add `web/.gitignore` entries: `.astro/`, `dist/`, `dist/pagefind/`.

**Verification:**
- `pnpm dev:web` (or `pnpm --filter @corvu-next/web dev`) boots. Home page renders topbar + empty content area. Zero console errors. Zero terminal warnings.
- `astro check` clean.

**Success:** empty layout renders under Solid 2 through our forked integration.

## Phase 3 — Layouts and interactive TSX components

**Goal:** every `.astro` layout template and every non-example interactive `.tsx` under `web/src/components/**` migrated to Solid 2.

**Mechanical pre-pass (one commit, applied to `web/src/**/*.tsx`):**
- `from 'solid-js/web'` → `from '@solidjs/web'`
- `mergeProps(` → `merge(`
- `splitProps(` → `omit(`
- `onMount(` → `onSettled(`
- `classList={` → `class={`
- `<Suspense>` → `<Loading>`
- `@corvu/` → `@corvu-next/` (imports only)
- `from 'solid-list'` → `from '@corvu-next/solid-list'`
- `from 'solid-persistent'` → `from '@corvu-next/solid-persistent'`

Preferred tool: `ast-grep` with per-language rules committed to `corvu/scripts/solid2-rename.yml`. Fall back to `sed` for `from '…'` string rewrites where AST match isn't needed. Commit the pre-pass separately from any semantic changes.

**Hand-port per component** using `SOLID2-MIGRATION-LESSONS.md` as a checklist. Priority order:
1. `Head.astro`, `Topbar.astro`, `ThemeScript.astro`, `PlatformScript.astro`, `SidebarNavScript.astro`, `Background.tsx` — must boot without errors before any other page works.
2. `docs/nav/Navigation.astro`, `docs/nav/NavLink.astro`, `docs/headings/H2.astro`, `docs/headings/H3.astro`, `docs/Link.astro` — page structure.
3. `docs/code/Code.astro`, `docs/code/RawCode.astro`, `docs/code/CopyToClipboard.tsx` — code rendering.
4. `docs/TableOfContents.tsx`, `docs/Features.astro`, `docs/KeyboardNavigation.astro`, `docs/PackageInfo.astro`.
5. `Drawer.tsx`, `ThemeSelect.tsx` — the two components most likely to hit `@solid-primitives/storage@next` API shifts. Prepare for a small deviation from upstream if the storage API moved.
6. `docs/primitives/PrimitivesOverview.astro`, `docs/utilities/UtilitiesOverview.astro` — overview grids.
7. `ExampleWrapper.tsx` — the mount host for every primitive example. Test in isolation via a scratch route before Phase 4.

**Per-file lessons to apply from `SOLID2-MIGRATION-LESSONS.md`:**
- Split-phase `createEffect(compute, apply)` where the compute reads reactively and the apply writes/mutates DOM.
- Return cleanup from apply phase (replacing `onCleanup` inside effects).
- `createContext<T | null>(null)` — Solid 2 `useContext` throws on undefined default.
- `{ ownedWrite: true }` on signal writes from apply-phase or otherwise owned scopes.
- `mergeProps` → `merge`, `splitProps` → `omit`.
- Draft-first store setters (default behavior); use `storePath()` for opt-in path style.
- Ref directive factories replace `use:` directives.
- Resolve `STRICT_READ_UNTRACKED` and `REACTIVE_WRITE_IN_OWNED_SCOPE` warnings before commit.

**Verification per file:**
- File type-checks (`astro check` or `tsc --noEmit`).
- Scratch route (`web/src/pages/_scratch.astro`) mounts the component in isolation; interact; verify zero console warnings.
- No unhandled promise rejections.

**Success:** every layout and interactive component renders and behaves without runtime warnings.

## Phase 4 — MDX prose and per-primitive examples

**Goal:** every primitive's MDX page renders prose + working examples that import from `@corvu-next/*`.

**Files touched:**
- `web/src/content/**/*.mdx` (or `web/src/content/docs/**` — verify actual location after Phase 2 import).
- `web/src/examples/primitives/**/*.tsx` — every example file.
- `web/src/examples/primitives/**/*.css` — verify unchanged; Tailwind class semantics shouldn't shift.

**Mechanical work:**
- Mechanical pre-pass from Phase 3 already covered `@corvu/` → `@corvu-next/` and `solid-list`/`solid-persistent` retargeting. Re-run against `web/src/examples/**` if not already scoped.
- Frontmatter should not need edits; MDX schema is inherited from Phase 2's Astro config.

**Hand-work per example:**
- Confirm example mounts inside `ExampleWrapper.tsx`.
- Interact: open/close for Dialog/Popover/Tooltip; drag for Drawer; keyboard nav for Calendar/Accordion; resize for Resizable; type for OTPField.
- Zero console warnings. Any warning is a real Solid 2 issue in the primitive itself or in the example's usage.

**Success:** every route under `/docs/primitives/**` and `/docs/utilities/**` renders prose and mounts working examples.

## Phase 5 — Typedoc pipeline and API reference

**Goal:** API reference pages generate against `@corvu-next/*` source.

**Files touched:**
- Every `packages/*/package.json`: add `"typedoc": "typedoc --json api.json --entryPoints ./src/index.ts"`. Add `typedoc@^0.27.9` (or the latest compatible with our TS version) to devDependencies.
- Workspace root `package.json`: add typedoc as a devDep if we prefer a single hoisted install.
- `turbo.json`: add
  ```json
  "typedoc": { "dependsOn": ["^build"], "outputs": ["api.json"] }
  ```
  and add `"^typedoc"` to `@corvu-next/web#dev` and `@corvu-next/web#build` dependsOn.
- `.gitignore`: ensure `packages/*/api.json` is excluded.
- `web/src/lib/typedoc/libraries.ts`:
  - Retarget every relative import path if package directory names differ (they don't — same `packages/<name>/api.json`).
  - Rekey the `Typedoc` map from `@corvu/accordion` → `@corvu-next/accordion` etc. Typedoc records package name from `package.json` `"name"`, so keys must match our fork's names.
  - `solid-list` → `@corvu-next/solid-list`; same for every unscoped upstream primitive.
- `web/src/lib/typedoc/resolve/lib.ts`:
  - Audit `resolveReferenceType` — the switch on `type.package` explicitly names `solid-js`, `typescript`, and `@floating-ui/*`. Unknown packages fall through to `Typedoc[type.package]` lookup. With updated `Typedoc` map keys, this should work. Verify by running once against `@corvu-next/dialog` after adding the typedoc script.

**Verification:**
- `pnpm turbo run typedoc --filter=./packages/*` produces `packages/*/api.json` for every package.
- `pnpm dev:web` renders each primitive's API reference block with components, props, contexts, children-props, tags.
- No `Declaration with Name X not found` or `Declaration with ID Y not found` errors thrown from `resolve/lib.ts`.

**Success:** API reference pages render, structurally identical to upstream.

## Phase 6 — Pagefind and Search

**Goal:** Ctrl+K opens Search dialog; typing produces hits; arrow-nav + Enter navigates.

**Files touched:**
- `web/package.json`: `pnpm add -D pagefind` in the `web/` workspace.
- `web/package.json` scripts:
  ```json
  "build": "astro build && pagefind --site dist"
  ```
- `web/src/components/docs/search/Search.tsx`:
  - Replace the Typesense fetch effect (~30 lines: `fetchResults` inside the third `createEffect`) with a Pagefind JS API call:
    ```typescript
    // Load pagefind lazily
    const [pagefind, setPagefind] = createSignal<any>(null)
    createEffect(async () => {
      // @ts-expect-error - dynamic import of pagefind runtime
      const pf = await import('/pagefind/pagefind.js')
      await pf.init()
      setPagefind(pf)
    })
    // In the search-value effect, replace fetch with:
    const pf = pagefind()
    if (!pf) return
    const res = await pf.search(_searchValue)
    const hits = await Promise.all(res.results.slice(0, 6).map((r: any) => r.data()))
    // Map hits to the existing SearchResult shape
    ```
  - Delete the `PUBLIC_SEARCH_API_URL` / `PUBLIC_SEARCH_API_KEY` references.
  - Keep everything else: Dialog wrapping, `createList` keyboard nav, `SearchItem` rendering, group-by-title layout, keyboard shortcut hints.
- `web/src/env.d.ts`: remove Typesense env-var typings if any exist.

**Dev-mode wart handling:**
- Add a note to `web/CONTRIBUTING.md`: `pnpm build` before `pnpm dev` to seed the Pagefind index, or run `pnpm build && pnpm preview` for full search verification.
- Optionally: guard `pagefind()` load behind `import.meta.env.PROD` and render a "Search available in production build only" hint in dev. Decide per team preference during Phase 6 execution.

**Verification:**
- `pnpm --filter @corvu-next/web build` completes; `dist/pagefind/` directory exists with `pagefind.js`, `pagefind-ui.js`, index shards, and metadata.
- `pnpm --filter @corvu-next/web preview` serves the built site.
- Ctrl+K opens dialog; typing "dialog" returns hits pointing at `/docs/primitives/dialog/`; arrow keys move selection; Enter navigates.

**Success:** Search returns relevant results for common queries against local content.

## Phase 7 — CI, provenance, sunset docs

**Goal:** CI enforces build correctness; provenance is documented; sunset trigger is machine-readable.

**Files touched:**
- `.github/workflows/docs.yml`:
  ```yaml
  name: docs
  on:
    pull_request:
      paths:
        - "web/**"
        - "packages/astrojs-solid-next/**"
        - "packages/*/src/**"
        - "packages/*/package.json"
        - ".github/workflows/docs.yml"
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: pnpm
        - run: pnpm install --frozen-lockfile
        - run: pnpm turbo run typedoc --filter=./packages/*
        - run: pnpm --filter @corvu-next/web astro check
        - run: pnpm --filter @corvu-next/web build
  ```
- `web/CONTRIBUTING.md`: manual smoke checklist covering
  1. `pnpm dev:web` boots without terminal warnings.
  2. Home page renders topbar, sidebar, primitive grid.
  3. Each primitive page (`/docs/primitives/<name>/`) renders prose, examples, API reference.
  4. Interact with each example (open Dialog, drag Drawer, resize Resizable, calendar keyboard nav, OTPField typing, Popover placement, Tooltip hover-delay, Accordion expand, Disclosure toggle).
  5. Ctrl+K opens Search (in preview build); query returns hits; arrow-nav + Enter navigates.
  6. `astro build` succeeds; `astro check` clean.
- `web/README.md`:
  - Status banner: "Under active migration during Phases 1–6."
  - Runs entirely locally; no public deploy.
  - Provenance: source commit `corvudev/corvu@ff79bca9`.
- `docs/DOCS-MIGRATION-PLAN.md`: this file, marked complete when Phase 7 lands.

**Sunset triggers (recorded here, enforced manually):**
1. Upstream Kobalte publishes `@kobalte/core` with a `solid2` or `next` npm dist-tag, OR
2. Upstream corvu publishes any `@corvu/*` package targeting `solid-js@^2.0.0-beta.14` or later, OR
3. Upstream merges the Solid 2 migration offered in `corvudev/corvu#106`.

**Sunset procedure:**
1. `git tag docs-final-$(date +%Y-%m-%d)` and push the tag.
2. Open a single sunset PR:
   - `rm -rf web/`.
   - `rm -rf packages/astrojs-solid-next/`.
   - Remove `typedoc` scripts from every `packages/*/package.json`.
   - Remove `typedoc` devDependency from the workspace.
   - Remove the `typedoc` task and `@corvu-next/web#*` entries from `turbo.json`.
   - Remove `.github/workflows/docs.yml`.
   - Remove this file (`docs/DOCS-MIGRATION-PLAN.md`) or add a "Sunsetted YYYY-MM-DD, see git tag `docs-final-YYYY-MM-DD`" note.
   - Update root `README.md` to remove docs-related references.
3. Merge the sunset PR.
4. Update the workspace `README.md` (workspace root, one level above the corvu fork) to note the docs migration is retired and point at the upstream replacement.

**Success:** CI green on `main`, smoke checklist documented, sunset triggers and procedure recorded.

## Provenance

- Upstream corvu commit at time of import: `ff79bca96ead89a703637c0738191e20e1ffa67d` (`build: update dependencies`, 2025-08-07).
- Upstream Astro at time of Solid integration import: `withastro/astro@main` as of this plan's authoring date. Exact commit recorded in `packages/astrojs-solid-next/PROVENANCE.md` on import.

## Non-goals

- Public deployment. If scope changes, that's a new decision, and Pagefind → Typesense migration is a bounded rewrite of one file.
- Playwright E2E tests. Manual smoke checklist covers the runtime-parity bar for a delete-later fork.
- Preserving Typesense as a fallback. Pagefind fully replaces it; Typesense env vars are removed.
- Syncing upstream commits during the fork's lifetime. Manual cherry-pick only if a specific upstream change becomes valuable.

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| `vite-plugin-solid@3.0.0-next.5` + Astro 5 + Vite 8 chain untested together. | Phase 1 verifies with a hello-world before Phase 2 touches any content. |
| `@astrojs/solid-js` internal renderer imports from `solid-js/web`; Solid 2 may require deeper porting than a peer bump. | Phase 1 audits every `src/**/*.ts` and `src/**/*.tsx` in the imported integration and applies the same lessons as our primitive migration. |
| `@solid-primitives/storage@5.0.0-next.0` might silently change behavior even though the export list is preserved. | Verified 2026-07-16: `primitive.list` on the published version matches 4.4.0 (`makePersisted`, `cookieStorage`, `tauriStorage`, `multiplexStorage`, `storageSync`, `messageSync`, `wsSync`, `multiplexSync`, `addClearMethod`, `addWithOptionsMethod`, `makeObjectStorage`). Risk residual: implementation-level behavior may still shift. Q6 escape hatch (fresh rewrite of `ThemeSelect.tsx`) remains available if it stalls. |
| Typedoc emits package names from `package.json` `"name"`; `resolve/lib.ts` gates on those names. | Phase 5 verification catches mismatches early via `Declaration not found` errors. |
| Pagefind's search quality on ~30 pages may be thin. | Acceptable for local-only scope. If scope changes, revisit search backend. |
| A phase stalls (e.g., Drawer's snappoint physics regresses under Solid 2 beta.17). | Phased plan (Q10) allows partial merge; the specific primitive can be quarantined and skipped in the smoke checklist. |
| `main` carries partial state between phases. | Exclude `web/` from default `pnpm build` (Turbo filter) until Phase 7 lands. Mark `web/README.md` "under active migration." |
