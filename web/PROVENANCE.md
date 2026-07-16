# Provenance

This directory is imported from upstream `corvudev/corvu`.

- **Upstream repo:** https://github.com/corvudev/corvu
- **Upstream path:** `web/`
- **Import commit:** `ff79bca96ead89a703637c0738191e20e1ffa67d` (`build: update dependencies`, 2025-08-07)
- **Import date:** 2026-07-16

## Modifications from upstream

1. **Package name:** `@corvu/web` → `@corvu-next/web`
2. **Integration:** `@astrojs/solid-js@^5.1.0` → `@corvu-next/astrojs-solid-next` (workspace link)
3. **Solid version:** `solid-js@^1.9.8` → `solid-js@2.0.0-beta.19` + `@solidjs/web@2.0.0-beta.19`
4. **Package references:** `@corvu/*` → `@corvu-next/*`; `solid-list` → `@corvu-next/solid-list`; `solid-persistent` → `@corvu-next/solid-persistent`
5. **Site URL:** `https://corvu.dev` → `http://localhost:4321` (local-only)
6. **Removed:** `@astrojs/sitemap` (not needed for local dev), eslint/prettier deps (not needed)
7. **Removed:** `.env.example`, `typesense.config.json`, `vercel.json` (deployment artifacts)

## Sync policy

No ongoing sync with upstream. One-time import.
