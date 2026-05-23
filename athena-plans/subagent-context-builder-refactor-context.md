# Refactor-only architecture context: `raindropio`

## Request scope
Build planning context for a safe split-into-files architecture improvement. No product behavior changes requested. I inspected `src/raindrop.tsx`, package scripts, `tsconfig.json`, and relevant installed `@vicinae/api` typings. I did not modify source files.

## Repository shape and validation baseline
- Only source entrypoint exists: `src/raindrop.tsx`.
- Manifest/extension config lives in `package.json`; command name is `raindrop`, mode `view`, and Vicinae build currently detects `src/raindrop.tsx` as the entrypoint.
  - `package.json:12-19` defines the command.
  - `npm run build` output: `entrypoints [src/raindrop.tsx]`, build succeeds.
- Scripts:
  - `package.json:30-35`: `build: vici build`, `dev: vici develop`, `format: biome format --write src`, `lint: biome check src`.
- TS config constraints:
  - `tsconfig.json:4`: includes all `src/**/*`, so additional files under `src/` are included.
  - `tsconfig.json:6-16`: `lib` includes `dom` for `fetch`, `RequestInit`, `Headers`; `strict: true`; `isolatedModules: true`; `jsx: react-jsx`; `module: commonjs`.
- Current validation status before refactor:
  - `npm run lint` passes: Biome checked 1 file.
  - `npm run build` passes: types checked and extension built successfully.

## Current `src/raindrop.tsx` responsibilities
This single file is ~860 lines and mixes several separable concerns:

1. Vicinae/React entrypoint and main list view
   - Imports from `@vicinae/api` and React at `src/raindrop.tsx:1-14`.
   - Default export `RaindropBookmarks` at `src/raindrop.tsx:78-642`.
   - The entrypoint must remain a default export from `src/raindrop.tsx` because Vicinae build maps the command to that file.

2. Domain and API types
   - `Preferences`, `Raindrop`, `Collection`, response types at `src/raindrop.tsx:16-63`.

3. Constants
   - `RAINDROP_API_BASE_URL`, `MAX_COLLECTION_SUGGESTIONS`, `BUILT_IN_COLLECTIONS` at `src/raindrop.tsx:65-72`.

4. API client/request helper and fetch effects
   - Inline authenticated `request<T>` callback at `src/raindrop.tsx:93-116`.
   - Collections effect at `src/raindrop.tsx:122-172` calls `/collections` and `/collections/childrens` in parallel.
   - Raindrops effect at `src/raindrop.tsx:174-215` calls `/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true`.
   - Mutations inline in callbacks:
     - Rename: `PUT /raindrop/${id}` at `src/raindrop.tsx:281-305`.
     - Toggle favorite: `PUT /raindrops/${collectionId}` with `ids`, `important` at `src/raindrop.tsx:307-344`.
     - Move: `PUT /raindrops/${collectionId}` with `ids`, `collection` at `src/raindrop.tsx:346-389`.
     - Delete/trash: `DELETE /raindrops/${collectionId}` at `src/raindrop.tsx:391-433`.

5. Derived collection/list state
   - Nested collection title derivation at `src/raindrop.tsx:217-228`.
   - `allCollections`, `moveTargetCollections`, selected title, suggestions at `src/raindrop.tsx:230-274`.
   - Dropdown change at `src/raindrop.tsx:276-279`.

6. UI rendering
   - `List` props and dropdown at `src/raindrop.tsx:450-494`.
   - Collection suggestion section at `src/raindrop.tsx:496-526`.
   - Bookmark section and item rendering/actions at `src/raindrop.tsx:528-640`.
   - Rename form embedded below main component at `src/raindrop.tsx:644-699`.

7. Pure helpers
   - Sorting/normalization/dedup/matching/display helpers at `src/raindrop.tsx:701-793`.
   - Mutation collection selection at `src/raindrop.tsx:795-806`.
   - HTTP JSON/error helpers at `src/raindrop.tsx:808-835`.
   - Markdown helpers at `src/raindrop.tsx:838-860`.

## Vicinae API typing facts relevant to splitting UI components
Installed `@vicinae/api` is `^0.8.2` per `package.json:36-39`.

Relevant component typings support extracting UI safely:
- `List` props allow `filtering`, `isLoading`, `isShowingDetail`, `searchText`, `searchBarAccessory`, `onSearchTextChange`; `List.Item` accepts `title`, `subtitle`, `icon`, `keywords`, `detail`, `actions`, `accessories` (`node_modules/@vicinae/api/dist/api/components/list.d.ts:25-50`).
- `List.Dropdown` supports `value`, `onChange`, `isLoading`, sections/items (`list.d.ts:63-90`).
- `Action.Push` target is `ReactNode`; `Action` `onAction` is `() => void`; `Action.SubmitForm` can return `boolean | void | Promise<boolean | void>` (`actions.d.ts:14-39`). Existing `onAction={() => void asyncFn()}` pattern is appropriate.
- `ActionPanel.Submenu` requires `children: ReactNode` (`action-pannel.d.ts:12-18`), so extracted move submenu must ensure it always supplies children, even if empty.
- `Form.TextField` has `defaultValue?: string`, `error?: string`, `autoFocus?: boolean`; `Form.Values` can contain string/number/boolean/string[]/number[]/Date/null (`form.d.ts:14-23`, `35-79`). Rename form extraction is straightforward.

## Safe split-into-files architecture proposal
Keep behavior unchanged; move code into small modules and preserve `src/raindrop.tsx` as the command entrypoint/default export.

Suggested target structure (names flexible):

```text
src/
  raindrop.tsx                  # entrypoint: imports and default-exports view
  types.ts                      # Preferences, Raindrop, Collection, API response types
  constants.ts                  # RAINDROP_API_BASE_URL, MAX_COLLECTION_SUGGESTIONS, BUILT_IN_COLLECTIONS
  api.ts                        # create/request helpers and Raindrop API functions
  collection-utils.ts           # collection derivation, matching, formatting, move target helpers
  bookmark-utils.ts             # sortFavoriteFirst, getMutationCollectionId, markdown helpers
  error-utils.ts                # getErrorMessage, parseJsonResponse/ensureMutationResult if not in api.ts
  components/
    RaindropBookmarks.tsx       # current main view/container logic
    RenameBookmarkForm.tsx      # current rename form
    CollectionDropdown.tsx      # dropdown render sections
    CollectionSuggestionSection.tsx
    BookmarkSection.tsx         # maps raindrops to items; may include BookmarkActions
    BookmarkActions.tsx         # action panel for a bookmark
```

Lower-risk phased alternative:
1. First extract only `types.ts`, `constants.ts`, and pure helpers (`collection-utils.ts`, `bookmark-utils.ts`, `api.ts` for `jsonRequestInit`/`parseJsonResponse`/`ensureMutationResult`) without changing the JSX structure.
2. Then extract `RenameBookmarkForm`.
3. Then extract render-only components (`CollectionDropdown`, `CollectionSuggestionSection`, `BookmarkSection`/`BookmarkActions`).

This sequence reduces risk because the main hook/dataflow remains intact until all pure exports compile.

## Deduplication and optimization opportunities
Refactor-only safe opportunities:
- Centralize API calls:
  - Replace inline endpoint construction with functions such as `fetchCollections(request)`, `fetchRaindrops(request, collectionId)`, `renameRaindrop`, `updateRaindrops`, `deleteRaindrops`.
  - Keep the authenticated request hook/callback in the React layer or expose a `useRaindropApi(apiToken)` hook. Avoid changing retry/cache behavior unless explicitly approved.
- Centralize mutation update patterns:
  - Current `rename`, `toggleFavorite`, `move`, and `delete` all perform request → `ensureMutationResult` → local state update → `refresh()` → toast. A small helper for API mutation is possible, but avoid overabstracting UI-specific state transitions.
- Extract pure collection helpers for easier future testing:
  - `uniqueCollections`, `uniqueCollectionSuggestions`, `getCollectionMatchScore`, `getCollectionName`, `getCollectionSubtitle`, `formatBookmarkCount`, `getCollectionTitle`, `isMoveTargetCollection`, `getMoveTargetCollections`.
- Extract markdown helpers:
  - `getMarkdownLink`, `escapeMarkdownLinkText`, `getMarkdown` are pure and can move without behavioral risk.
- Rendering optimization:
  - Current callbacks are memoized, but rendering each `List.Item` builds detail markdown/actions inline. Extracting memoized/render-only components can improve readability; actual runtime gain is likely minor because Vicinae list size is limited to 50 per request (`src/raindrop.tsx:183-185`).
- Fetch duplication:
  - `refreshToken` triggers both collections and raindrops reloads (`src/raindrop.tsx:122-172`, `174-215`). This is current behavior and should be preserved in a refactor-only task. Changing it to only refresh raindrops after mutations could be an optimization but changes network behavior and collection counts freshness semantics.

## Edge cases and invariants to preserve
- Entry point/default export:
  - `src/raindrop.tsx` must continue to default export the command component. `vici build` currently discovers `src/raindrop.tsx`.
- Auth request behavior:
  - Always set `Authorization: Bearer ${apiToken}` and preserve caller-provided headers (`src/raindrop.tsx:93-100`).
  - Parse text first, tolerate empty/invalid JSON (`src/raindrop.tsx:102-113`, `818-825`).
  - Non-OK responses throw `errorMessage` if provided, else status (`src/raindrop.tsx:107-110`).
- Loading and unmount safety:
  - Effects use local `isMounted` guards before setting state (`src/raindrop.tsx:122-172`, `174-215`). Preserve or replace with equivalent safe cancellation.
- Collection semantics:
  - Built-ins are ids `0` All Bookmarks, `-1` Unsorted, `-99` Trash (`src/raindrop.tsx:68-72`).
  - Move targets exclude All Bookmarks, Trash, and selected collection (`src/raindrop.tsx:773-783`), and then exclude the raindrop's current collection (`src/raindrop.tsx:786-792`). Preserve both filters.
  - Mutating from All Bookmarks requires the item’s actual `collection.$id`; if missing, throw `Could not determine bookmark collection` (`src/raindrop.tsx:795-806`). This can affect favorite/move/delete from All Bookmarks.
  - `selectedCollectionId` is a string throughout UI/dropdown; collection ids are numbers in domain objects. Preserve conversion points.
- Search/navigation behavior:
  - Typing 2+ chars shows collection suggestions above bookmarks if matches exist (`src/raindrop.tsx:256-274`, `496-526`).
  - Selecting a collection in dropdown clears `searchText` (`src/raindrop.tsx:276-279`).
  - `Action.Push` to a collection creates a new `RaindropBookmarks` instance with `initialCollectionId` (`src/raindrop.tsx:512-519`); `Search All Bookmarks` does the same with `0` (`src/raindrop.tsx:616-620`). If moving the component, update recursive references carefully.
- Mutation side effects:
  - Rename rethrows after showing toast so `RenameBookmarkForm` can keep the form open on failure (`src/raindrop.tsx:295-301`, `674-679`). Preserve this.
  - Toggle favorite catches and does not rethrow (`src/raindrop.tsx:335-341`).
  - Delete prompts via `confirmAlert`; permanent delete only when current selected collection is `-99` (`src/raindrop.tsx:391-418`).
  - `refresh()` is called after successful mutations (`src/raindrop.tsx:293`, `330`, `375`, `423`), causing both effects to reload. Preserve for refactor-only.
- Detail/markdown behavior:
  - Markdown title uses `Untitled` fallback; list item title uses `raindrop.title || raindrop.link` (`src/raindrop.tsx:535`, `846-859`).
  - Only `]` is escaped in markdown link text (`src/raindrop.tsx:838-843`). Do not broaden escaping in a pure refactor unless requested.
- Type/formatting risks:
  - `isolatedModules: true` means each new file must be a module (use imports/exports). Use `import type` for type-only imports where possible.
  - Biome may format tabs/indentation. `npm run format` is available, but source-changing agents should run it only if edits are made.

## Implementation risks
- Circular imports are the main architectural risk. Avoid having pure helpers import React components. Suggested dependency direction:
  - `types/constants` → no imports or type-only imports.
  - `api/utils` → import types/constants only.
  - `components` → import helpers/types/api.
  - `raindrop.tsx` → import default component and re-export.
- Recursive `Action.Push` references can create cycles if `CollectionSuggestionSection` imports the default entrypoint. Prefer passing a `createCollectionTarget(collectionId)` callback or pass the component from the container, or keep collection suggestion rendering in `RaindropBookmarks` until later.
- Extracting `BookmarkActions` requires passing several callbacks and values: `raindrop`, `selectedCollectionId`, `moveTargetCollections`, `renameBookmark`, `toggleFavorite`, `moveBookmark`, `deleteBookmark`, `refresh`, and a target for “Search All Bookmarks”. Over-splitting too early may reduce clarity.
- Extracting API request into a hook can change callback identities and effect dependencies. If done, preserve stable dependencies and avoid accidental infinite reloads.
- If `BUILT_IN_COLLECTIONS` is exported as mutable `Collection[]`, consumers could mutate it. A refactor can use `ReadonlyArray<Collection>` internally, but ensure APIs needing arrays accept readonly or spread into mutable arrays.

## Suggested validation checks for the implementation agent
Run after edits:
1. `npm run lint`
2. `npm run build`
3. If code was moved into many files and `format` was not run, consider `npm run format` then re-run lint/build.
4. Manual behavior checklist if Vicinae dev is available (`npm run dev`):
   - Extension opens and loads collections/bookmarks.
   - Dropdown changes collection and clears search.
   - Typing a collection name shows suggestions; pushing into collection works.
   - Open/copy actions still appear.
   - Rename validation rejects blank title and keeps form open on API failure.
   - Favorite, move, trash/permanent delete actions still target the expected endpoint behavior.

## Implementation-ready meta-prompt

### Goal
Perform a refactor-only architecture split of the current single-file Vicinae Raindrop extension into coherent modules/components while preserving all existing behavior, public command entrypoint, and validation success.

### Context/evidence
- Current code is entirely in `src/raindrop.tsx` and passes `npm run lint` and `npm run build`.
- `src/raindrop.tsx` contains domain/API types (`16-63`), constants (`65-72`), main default component (`78-642`), rename form (`644-699`), and pure helpers (`701-860`).
- `package.json` command config points to command name `raindrop`; Vicinae build discovers `src/raindrop.tsx` as entrypoint. Keep that file and a default export.
- `tsconfig.json` includes all `src/**/*`, uses strict TypeScript, isolated modules, DOM lib, and React JSX runtime.
- Installed `@vicinae/api` typings support extracting `List`, `ActionPanel`, `Action`, and `Form` usage as React components; `Action.Push.target` is `ReactNode`; `Action.onAction` is synchronous `() => void`, so preserve `void asyncFn()` wrappers.

### Success criteria
- Source is split into sensible modules (at minimum: types/constants, API/request helpers, pure collection/bookmark helpers, and `RenameBookmarkForm`; optionally render-only list/action components if done safely).
- `src/raindrop.tsx` remains the command entrypoint and default-exports the Raindrop view.
- No intentional functional/API/UI behavior changes.
- `npm run lint` and `npm run build` pass.
- Imports are acyclic and type-only imports are used where appropriate.

### Hard constraints
- Refactor-only: do not add new features, change API endpoints, change mutation semantics, change search behavior, or change toasts/prompts except as necessary to preserve behavior through extracted code.
- Preserve current refresh behavior after successful mutations: `refresh()` reloads both collections and raindrops through the shared refresh token.
- Preserve All Bookmarks mutation logic using `raindrop.collection.$id` and throwing when missing.
- Preserve `RenameBookmarkForm` failure behavior: blank title returns `false`; API failure keeps form open.

### Suggested approach
1. Extract domain types and constants.
2. Extract pure helpers into utility modules with no React/Vicinae imports.
3. Extract API/request helpers or API functions while keeping auth header behavior and JSON parsing identical.
4. Extract `RenameBookmarkForm`.
5. Optionally extract render-only pieces (`CollectionDropdown`, collection suggestions, bookmark items/actions`) but pass callbacks/targets from the container to avoid circular imports.
6. Keep the main container responsible for state/effects unless a hook extraction can be done without changing dependencies or behavior.

### Validation
Run `npm run lint` and `npm run build`. If available, smoke-test with `npm run dev` using the manual checklist above.

### Stop/escalation rules
- Stop and ask for a decision if a change would alter network behavior, pagination, search semantics, collection refresh semantics, destructive action behavior, or markdown escaping.
- If build tooling cannot resolve a newly split entrypoint, restore `src/raindrop.tsx` as a thin default-export wrapper and re-run build.
- Do not pursue performance changes beyond extraction/memo-friendly boundaries unless explicitly approved.

### Resolved assumptions
- This task is architectural only; tests are not present in the repo, so lint/build plus optional Vicinae manual smoke test are the available validations.
- No external API behavior research is needed for a pure refactor because endpoints and semantics should be preserved exactly from existing code.
