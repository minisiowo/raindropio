# Project Agent Guide

## Project overview

This is a TypeScript/React Vicinae extension for browsing and managing Raindrop.io bookmarks. The extension manifest, command registration, preferences, and scripts live in `package.json`.

## Important paths

- `src/` contains all runtime source. See `src/AGENTS.md` for source-specific invariants.
- `src/raindrop.tsx` must remain the default-export entrypoint for the Vicinae `raindrop` command.
- `assets/extension_icon.png` is the extension icon referenced by the manifest.
- `athena-plans/` contains planning/context artifacts, not runtime code.
- Do not edit `node_modules/` or generated `vicinae-env.d.ts`.

## Commands

- Install dependencies: `npm install`
- Develop in Vicinae: `npm run dev`
- Format source: `npm run format`  # writes under `src/`
- Lint/check source: `npm run lint`
- Build/type-check extension bundle: `npm run build`
- Additional TypeScript check used in this repo: `npx tsc --noEmit`

After source changes, prefer:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run `npm run format` when formatting changes are intended.

## Safety notes

- The Raindrop API token is a password preference named `apiToken`; never hard-code, log, toast, or commit real tokens.
- Bookmark data is private user data. Avoid debug output that exposes titles, URLs, tags, excerpts, collection names, or API payloads.
- Do not hand-edit `package-lock.json` unless dependency changes were made through npm.
