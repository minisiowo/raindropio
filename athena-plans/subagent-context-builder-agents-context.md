# AGENTS.md Context Findings for raindropio

Scope: inspected repository config and the refactored `src/` subtree for sparse, repository-specific future-agent guidance. Repository was kept read-only except for this requested findings file.

## Current repository shape

- No existing `AGENTS.md` found anywhere in the repo.
- Vicinae extension metadata and commands live in `package.json`:
  - `package.json:2` points at the Vicinae extension schema.
  - `package.json:12-19` defines one view command named `raindrop`.
  - `package.json:21-28` defines required password preference `apiToken`.
  - `package.json:30-35` scripts: `npm run build` -> `vici build`, `npm run dev` -> `vici develop`, `npm run format` -> `biome format --write src`, `npm run lint` -> `biome check src`.
  - `package.json:36-44` dependencies: `@vicinae/api`, React, TypeScript, Biome.
- `package-lock.json:714-733` resolves `@vicinae/api` to `0.8.5` and provides the `vici` binary.
- TypeScript config includes only `src/**/*` (`tsconfig.json:4`) and uses strict TS, isolated modules, CommonJS, ES2020, React JSX (`tsconfig.json:5-17`).
- `.gitignore:1-2` ignores `node_modules` and generated `vicinae-env.d.ts`.
- No `biome.json`/Biome config found; Biome defaults are currently in effect. Existing source formatting uses tabs.

## Vicinae entrypoint invariant

- `src/raindrop.tsx:1-3` is the command entrypoint for the `package.json` command named `raindrop`; it only imports and default-exports `RaindropBookmarks`.
- Future agents should not rename `src/raindrop.tsx` or `package.json` command `name` independently. Vicinae command discovery depends on this convention.
- Keep entrypoint thin; put app logic in components/utilities, as currently done.

## Source boundaries and key invariants

### `src/components/`

- `src/components/RaindropBookmarks.tsx` is the stateful top-level UI/data coordinator:
  - Reads the password preference via `getPreferenceValues<Preferences>()` (`RaindropBookmarks.tsx:46-61`).
  - Creates the authenticated request function with `createRaindropRequest(apiToken)` (`RaindropBookmarks.tsx:61`).
  - Loads root/child collections from `/collections` and `/collections/childrens` (`RaindropBookmarks.tsx:67-117`).
  - Loads bookmarks from `/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true` (`RaindropBookmarks.tsx:119-160`).
  - Builds child collection display paths as `Parent / Child` (`RaindropBookmarks.tsx:162-173`).
  - Combines built-in, root, and child collections with de-duplication (`RaindropBookmarks.tsx:175-183`).
  - Collection search suggestions start at 2 chars and score via utils (`RaindropBookmarks.tsx:201-219`).
  - Mutations live here: rename (`RaindropBookmarks.tsx:226-250`), favorite toggle (`252-289`), move (`291-334`), trash/permanent delete (`336-380`).
  - Delete is confirmation-gated with `confirmAlert`; permanent delete only while selected collection is Trash (`RaindropBookmarks.tsx:336-364`).
  - Recursive `Action.Push` targets instantiate a new `RaindropBookmarks` for collection navigation (`RaindropBookmarks.tsx:418-441`).
- Other components are intentionally mostly presentational/action composition:
  - `BookmarkListSection.tsx:32-64` renders items, details, and delegates actions.
  - `BookmarkActions.tsx:35-105` defines action panel sections (open/copy/edit/navigation/danger). It should not perform API calls directly.
  - `CollectionDropdown.tsx:21-55` renders built-in/root/nested collection dropdown sections.
  - `CollectionSuggestionsSection.tsx:11-43` renders collection search results and pushes into a collection target.
  - `RenameBookmarkForm.tsx:25-69` validates non-empty title, displays loading/error, and calls parent `onRename`.

### `src/api/`

- `src/api/raindrop-api.ts` is the transport/helper boundary:
  - `createRaindropRequest(apiToken)` injects `Authorization: Bearer ${apiToken}` on every request (`raindrop-api.ts:4-12`).
  - It reads the response as text, parses JSON leniently, throws an `Error` with `errorMessage` or status on non-OK responses (`raindrop-api.ts:13-24`).
  - `jsonRequestInit()` sets JSON content type and stringifies body (`raindrop-api.ts:28-36`).
  - `ensureMutationResult()` enforces Raindrop mutation `result` success (`raindrop-api.ts:48-55`).
- Keep API helpers UI-free: no Vicinae toasts/navigation/components in `src/api/`.

### `src/utils/`

- Utilities are pure and should stay free of React/Vicinae side effects:
  - Collection helpers: normalization, de-duping, matching/scoring, display labels, move-target filtering, mutation collection-id resolution (`utils/collections.ts:4-105`).
  - Error fallback helper (`utils/errors.ts:1-3`).
  - Markdown/render-copy helpers (`utils/markdown.ts:3-25`). Note only `]` is escaped in markdown link text (`markdown.ts:7-9`); URLs/titles/excerpts/tags are user/private content.
  - Favorite-first sorting (`utils/raindrops.ts:3-8`).

### Shared constants/types

- Built-in collection IDs are important API invariants: All Bookmarks `0`, Unsorted `-1`, Trash `-99` (`src/constants.ts:3-13`).
- Raindrop API base URL is `https://api.raindrop.io/rest/v1` (`src/constants.ts:7`).
- Shared response/domain types live in `src/types.ts`; preference shape is `{ apiToken: string }` (`types.ts:1-52`).

## Local hazards future agents should know

- Token/privacy:
  - `apiToken` is a required password preference (`package.json:21-28`) and is inserted only into the Authorization header (`raindrop-api.ts:4-12`). Never log, toast, commit, or include tokens in plans/transcripts.
  - API responses contain a user’s bookmarks, URLs, titles, tags, excerpts, and collection names. Treat them as private. Avoid adding debug logs or broad telemetry.
  - Clipboard actions intentionally expose bookmark URL/title/markdown to the user (`BookmarkActions.tsx:41-50`); do not expand clipboard behavior to include tokens or full API payloads.
- Destructive actions:
  - `Move to Trash`/`Delete Permanently` share the delete mutation path; permanent delete is only selected when current collection is Trash (`RaindropBookmarks.tsx:336-364`, `BookmarkActions.tsx:92-102`). Preserve confirmation for destructive actions.
- All Bookmarks mutation hazard:
  - Mutating from All Bookmarks must use the raindrop’s actual `collection.$id`; `getMutationCollectionId()` throws if unavailable (`utils/collections.ts:92-105`). Do not bypass this when adding mutations.
- Collection boundaries:
  - Move targets intentionally exclude All Bookmarks, Trash, and the current collection (`utils/collections.ts:70-80`), and exclude the item’s existing collection (`utils/collections.ts:83-89`).
- Loading/effects:
  - Existing effects use `isMounted` guards around async state updates (`RaindropBookmarks.tsx:67-117`, `119-160`). Preserve this pattern or replace with an equivalent cancellation-safe pattern.
- Formatting/config:
  - `npm run format` writes changes; `npm run lint` does not apply fixes. Since no Biome config exists, avoid assuming custom style beyond current Biome defaults/source style.

## Validation commands

Observed/available scripts:

- `npm run lint` — runs `biome check src`; executed successfully: `Checked 14 files in 8ms. No fixes applied.`
- `npx tsc --noEmit` — executed successfully with no output.
- `npm run build` — available via `vici build`; not run during this read-only inspection because builds may create artifacts.
- `npm run dev` — starts Vicinae development mode; interactive, not a CI check.
- `npm run format` — writes formatted files under `src`; only run when edits are intended.

Recommended check set after future source edits: `npm run lint` and `npx tsc --noEmit`; run `npm run build` when artifact creation is acceptable/expected.

## Should `src/` get a nested `AGENTS.md`?

Recommendation: **Yes, if creating sparse repository-specific guidance, add a nested `src/AGENTS.md` focused on source-code invariants.**

Rationale:

- Most future hazards are source-local: Vicinae entrypoint mapping, `components`/`api`/`utils` boundaries, Raindrop collection ID semantics, mutation/delete safety, and token/privacy handling.
- A root `AGENTS.md` can stay minimal for repository-level commands/config (`npm run lint`, `npx tsc --noEmit`, build/dev/format caveats, no secrets). A nested `src/AGENTS.md` would keep code-specific guidance close to where agents edit.
- If the project wants only one file, root guidance is sufficient because the repo is small; however, the requested “sparse” guidance is cleaner as root + `src/AGENTS.md`.

Suggested contents split:

- Root `AGENTS.md`: project type (Vicinae extension), validation commands, read/write caveats (`format` writes, build may emit artifacts), token/privacy rule, keep `src/raindrop.tsx` aligned with command name.
- `src/AGENTS.md`: entrypoint invariant; directory boundaries (`components` state/UI, `api` transport only, `utils` pure, shared constants/types); built-in collection IDs; mutation/delete hazards; no logging tokens/private bookmark payloads.
