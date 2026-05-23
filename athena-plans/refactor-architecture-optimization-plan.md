# Raindrop.io Vicinae Extension — Refactor, Deduplication, Architecture, Optimization Plan

## Status

Plan-only artifact. Do not implement until approved.

## Goal

Refactor the current single-file Vicinae extension into a cleaner multi-file architecture with better separation of concerns, less duplication, safer future changes, and modest maintainability/performance improvements — without changing user-visible behavior or Raindrop.io API semantics.

Current source state:

- Only source file: `src/raindrop.tsx`
- Current size: ~860 lines
- Current validation baseline:
  - `npm run lint` passes
  - `npm run build` passes
- Current entrypoint requirement:
  - `src/raindrop.tsx` must continue to default-export the command component because Vicinae discovers the command entrypoint from this file.

## Non-goals

Do **not** change behavior during this refactor:

- Do not change Raindrop.io endpoints or mutation semantics.
- Do not change search behavior.
- Do not change collection navigation behavior or `Action.Push` / `Escape` pop behavior.
- Do not change destructive action behavior.
- Do not change markdown escaping behavior beyond moving existing helpers.
- Do not add new product features.
- Do not add dependencies unless later explicitly approved.
- Do not commit changes.

## Repository Evidence

`src/raindrop.tsx` currently mixes these responsibilities:

1. Vicinae command entrypoint and main React view.
2. Domain/API types:
   - `Preferences`
   - `Raindrop`
   - `Collection`
   - `RaindropsResponse`
   - `CollectionsResponse`
   - `MutationResponse`
3. Constants:
   - `RAINDROP_API_BASE_URL`
   - `MAX_COLLECTION_SUGGESTIONS`
   - `BUILT_IN_COLLECTIONS`
4. API request helper:
   - authenticated `request<T>(path, init?)`
   - JSON parsing
   - API error extraction
5. Data loading effects:
   - collections loading
   - bookmarks loading
6. Mutation callbacks:
   - `renameBookmark`
   - `toggleFavorite`
   - `moveBookmark`
   - `deleteBookmark`
7. Derived collection state:
   - child collection display titles
   - `allCollections`
   - `moveTargetCollections`
   - `collectionSuggestions`
8. UI rendering:
   - `List`
   - `List.Dropdown`
   - collection suggestion items
   - bookmark list items
   - bookmark action panels
9. Form component:
   - `RenameBookmarkForm`
10. Pure helpers:
   - sorting
   - collection matching/dedup/display
   - mutation collection ID resolution
   - request helpers
   - markdown helpers

## Proposed Target Structure

Preferred final structure:

```txt
src/
  raindrop.tsx
  types.ts
  constants.ts
  api/
    raindrop-api.ts
  utils/
    collections.ts
    raindrops.ts
    markdown.ts
    errors.ts
  components/
    RaindropBookmarks.tsx
    RenameBookmarkForm.tsx
    CollectionDropdown.tsx
    CollectionSuggestionsSection.tsx
    BookmarkListSection.tsx
    BookmarkActions.tsx
```

### `src/raindrop.tsx`

Keep as the Vicinae command entrypoint.

Target content should be very small:

```tsx
export { default } from "./components/RaindropBookmarks";
```

If Vicinae build has issues with re-exported default, use:

```tsx
import RaindropBookmarks from "./components/RaindropBookmarks";

export default RaindropBookmarks;
```

This file must remain because current build detects `src/raindrop.tsx` as the command entrypoint.

### `src/types.ts`

Move current domain/API types here:

- `Preferences`
- `Raindrop`
- `Collection`
- `RaindropsResponse`
- `CollectionsResponse`
- `MutationResponse`
- `RaindropBookmarksProps`

Use `export type`.

### `src/constants.ts`

Move constants and replace magic IDs with named constants:

```ts
export const ALL_BOOKMARKS_COLLECTION_ID = 0;
export const UNSORTED_COLLECTION_ID = -1;
export const TRASH_COLLECTION_ID = -99;
export const MAX_COLLECTION_SUGGESTIONS = 6;
export const RAINDROP_API_BASE_URL = "https://api.raindrop.io/rest/v1";
```

Also export:

```ts
export const BUILT_IN_COLLECTIONS = [...];
```

Risk: if typed as `ReadonlyArray<Collection>`, some consumers may need spreading or readonly-compatible helper signatures. Keep this simple initially if needed.

### `src/api/raindrop-api.ts`

Move API/request concerns here.

Candidate exports:

```ts
export function createRaindropRequest(apiToken: string) {
  return async function request<T>(path: string, init?: RequestInit): Promise<T> { ... };
}

export function jsonRequestInit(method: string, body: unknown): RequestInit;
export function parseJsonResponse(responseText: string): unknown | undefined;
export function ensureMutationResult(data: MutationResponse, fallbackMessage: string): void;
```

Optional endpoint wrappers, if done without changing behavior:

```ts
export function fetchRootCollections(request): Promise<CollectionsResponse>;
export function fetchChildCollections(request): Promise<CollectionsResponse>;
export function fetchRaindrops(request, collectionId: string): Promise<RaindropsResponse>;
export function renameRaindrop(request, id: number, title: string): Promise<MutationResponse>;
export function updateRaindrops(request, collectionId: number, body: unknown): Promise<MutationResponse>;
export function deleteRaindrops(request, collectionId: number, ids: number[]): Promise<MutationResponse>;
```

Important invariants to preserve:

- Always set `Authorization: Bearer ${apiToken}`.
- Preserve caller-provided headers.
- Read response as text first.
- Tolerate empty/invalid JSON.
- Throw API `errorMessage` when non-OK response includes one.
- Return `{}` as typed response when success body is empty, matching current behavior.

### `src/utils/errors.ts`

Move:

```ts
getErrorMessage(error, fallbackMessage)
```

If `parseJsonResponse` and `ensureMutationResult` stay in API module, this file can be skipped.

### `src/utils/collections.ts`

Move collection-related pure helpers:

- `normalize`
- `uniqueCollections`
- `uniqueCollectionSuggestions`
- `getCollectionMatchScore`
- `getCollectionName`
- `getCollectionSubtitle`
- `formatBookmarkCount`
- `getCollectionTitle`
- `isMoveTargetCollection`
- `getMoveTargetCollections`
- `getMutationCollectionId`

Important invariants:

- Built-in IDs:
  - `0` = All Bookmarks
  - `-1` = Unsorted
  - `-99` = Trash
- Move targets must exclude:
  - All Bookmarks
  - Trash
  - currently selected collection
  - current bookmark collection when available
- Mutations from All Bookmarks must use `raindrop.collection.$id`.
- If a concrete collection ID is unavailable from All Bookmarks, throw `Could not determine bookmark collection`.

### `src/utils/raindrops.ts`

Move:

- `sortFavoriteFirst`

Keep sort stable enough for current behavior: favorites first, otherwise existing API order.

Current implementation uses `Array.prototype.sort` on a copied array. Modern JS sort is stable, but if we want to be explicit, implement stable sorting via index pairing. This would be a safe internal robustness improvement, but not required.

### `src/utils/markdown.ts`

Move:

- `getMarkdownLink`
- `escapeMarkdownLinkText`
- `getMarkdown`

Preserve current behavior:

- Markdown link text escapes `]` only.
- Detail markdown shows:
  - title or `Untitled`
  - excerpt
  - URL link
  - tags
  - created date

### `src/components/RaindropBookmarks.tsx`

Move the main component from `src/raindrop.tsx` here.

It should remain the state/container component initially:

- read preferences with `getPreferenceValues<Preferences>()`
- create request function
- own `selectedCollectionId`, `searchText`, loading/error state, `refreshToken`
- own load effects unless hooks are extracted in a later phase
- own mutation callbacks unless `useBookmarkActions` is extracted in a later phase
- compose presentational components

This phased approach reduces risk compared to extracting hooks and components all at once.

### `src/components/RenameBookmarkForm.tsx`

Move current `RenameBookmarkForm` here.

Props:

```ts
type RenameBookmarkFormProps = {
  raindrop: Raindrop;
  onRename: (id: number, title: string) => Promise<void>;
};
```

Preserve behavior:

- blank title shows form error and failure toast
- submit sets loading
- successful rename calls `pop()`
- failed API call returns `false` and keeps form open

### `src/components/CollectionDropdown.tsx`

Extract dropdown rendering.

Props:

```ts
type CollectionDropdownProps = {
  selectedCollectionId: string;
  isLoading: boolean;
  rootCollections: Collection[];
  childCollectionTitles: Collection[];
  onChange: (collectionId: string) => void;
};
```

Uses:

- `BUILT_IN_COLLECTIONS`
- `getCollectionTitle`

Preserve dropdown sections:

- Built-in
- Collections
- Nested Collections

### `src/components/CollectionSuggestionsSection.tsx`

Extract collection suggestion rendering.

Props:

```ts
type CollectionSuggestionsSectionProps = {
  collections: Collection[];
};
```

Important cycle risk:

- Current suggestion action does:

```tsx
<Action.Push target={<RaindropBookmarks initialCollectionId={collection._id.toString()} />} />
```

If `CollectionSuggestionsSection` imports `RaindropBookmarks`, it creates a component dependency. This is acceptable if it imports from `./RaindropBookmarks`, but to reduce circular risk, prefer passing a render callback or target factory:

```ts
type CollectionSuggestionsSectionProps = {
  collections: Collection[];
  renderTarget: (collectionId: string) => React.ReactNode;
};
```

Then main container passes:

```tsx
renderTarget={(collectionId) => <RaindropBookmarks initialCollectionId={collectionId} />}
```

Preserve:

- section title `Collections`
- item title/subtitle/icon/detail
- `Action.Push` title `Search in Collection`

### `src/components/BookmarkActions.tsx`

Extract only the `ActionPanel` for a single bookmark.

Props:

```ts
type BookmarkActionsProps = {
  raindrop: Raindrop;
  selectedCollectionId: string;
  moveTargetCollections: Collection[];
  onRename: (id: number, title: string) => Promise<void>;
  onToggleFavorite: (raindrop: Raindrop) => void;
  onMove: (raindrop: Raindrop, collection: Collection) => void;
  onDelete: (raindrop: Raindrop) => void;
  onRefresh: () => void;
  renderAllBookmarksTarget: () => React.ReactNode;
};
```

`onToggleFavorite`, `onMove`, `onDelete` can be typed as sync wrappers because `Action.onAction` is sync. The parent can pass wrappers or the component can call `void` internally.

Preserve sections:

- Open
- Copy
- Edit
- Navigation
- Danger Zone

Preserve actions:

- Open Bookmark
- Copy URL
- Copy Title
- Copy Markdown Link
- Rename Bookmark
- Mark/Unmark as Favorite
- Move to Collection submenu
- Refresh
- Search All Bookmarks
- Move to Trash / Delete Permanently

### `src/components/BookmarkListSection.tsx`

Extract bookmark list section and item rendering.

Props:

```ts
type BookmarkListSectionProps = {
  title: string;
  raindrops: Raindrop[];
  selectedCollectionId: string;
  moveTargetCollections: Collection[];
  onRename: ...;
  onToggleFavorite: ...;
  onMove: ...;
  onDelete: ...;
  onRefresh: ...;
  renderAllBookmarksTarget: () => React.ReactNode;
};
```

Preserve:

- title/subtitle count
- item title/subtitle/icon
- favorite accessory star on the right
- keywords from domain/tags
- detail markdown
- actions via `BookmarkActions`

## Optional Later Hook Extraction

After the safe file split passes validation, a second refactor can extract hooks:

```txt
src/hooks/
  useRaindropRequest.ts
  useCollections.ts
  useRaindrops.ts
  useBookmarkMutations.ts
```

Recommended not to do this in the first refactor unless the implementer is confident, because changing hook/effect dependencies is higher risk than extracting pure helpers and components.

If hooks are extracted later:

- `useCollections` should preserve root/child fetch behavior and loading toasts.
- `useRaindrops` should preserve selected collection fetch behavior and favorite-first sorting.
- `useBookmarkMutations` should preserve all success/failure toast behavior and local optimistic updates.
- Keep `refreshToken` semantics or explicitly introduce separate `refreshCollections` and `refreshRaindrops` only with approval.

## Deduplication Plan

### Immediate deduplication

1. Replace magic collection IDs with named constants.
2. Move all collection display/matching logic into one module.
3. Move all markdown logic into one module.
4. Move request/mutation response helpers into API module.
5. Extract repeated action panel JSX into `BookmarkActions`.
6. Extract repeated dropdown section rendering into `CollectionDropdown`.

### Avoid over-deduplication

Do **not** abstract mutation callbacks into a generic mutation executor unless it stays readable. Current mutations differ in:

- local state update shape
- whether they rethrow
- whether they require confirmation
- success messages
- endpoint/body shape

A too-generic mutation wrapper may reduce clarity.

## Optimization Plan

This is mostly a maintainability refactor. The extension only loads up to 50 raindrops per request, so performance gains are secondary.

Safe optimizations:

1. Keep `sortFavoriteFirst` pure and non-mutating.
2. Keep `useMemo` for:
   - child collection title derivation
   - all collections
   - move target collections
   - selected collection title
   - collection suggestions
3. Avoid recreating large action panel code inside the main component by extracting `BookmarkActions`.
4. Optionally make favorite sort explicitly stable if desired.
5. Preserve current coarse `refresh()` behavior for data consistency.

Do not optimize by:

- reducing refreshes after mutations unless approved
- changing pagination
- adding caching layers
- changing API request timing

## Recommended Implementation Phases

### Phase 1 — Pure extraction, lowest risk

Create:

- `src/types.ts`
- `src/constants.ts`
- `src/api/raindrop-api.ts`
- `src/utils/collections.ts`
- `src/utils/raindrops.ts`
- `src/utils/markdown.ts`

Move types/constants/helpers out of `src/raindrop.tsx`.

Keep the main component and JSX in `src/raindrop.tsx` during this phase.

Validation:

```bash
npm run format
npm run lint
npm run build
```

### Phase 2 — Move main component behind entrypoint

Create:

- `src/components/RaindropBookmarks.tsx`

Move the main component there.

Change `src/raindrop.tsx` to a thin wrapper/default export.

Validation:

```bash
npm run format
npm run lint
npm run build
```

### Phase 3 — Extract form and presentational components

Create:

- `src/components/RenameBookmarkForm.tsx`
- `src/components/CollectionDropdown.tsx`
- `src/components/CollectionSuggestionsSection.tsx`
- `src/components/BookmarkActions.tsx`
- `src/components/BookmarkListSection.tsx`

Keep the container responsible for state/effects/mutations.

Validation:

```bash
npm run format
npm run lint
npm run build
```

### Phase 4 — Optional hooks cleanup

Only after Phase 1-3 are stable, consider:

- `src/hooks/useCollections.ts`
- `src/hooks/useRaindrops.ts`
- `src/hooks/useBookmarkMutations.ts`

This phase should be separately approved if it changes effect dependencies or refresh behavior.

## Integration Points and Symbols to Preserve

### Entry point

- `src/raindrop.tsx` default export

### Main component API

- `RaindropBookmarks({ initialCollectionId = "0" })`

This is used recursively by:

- collection suggestion `Action.Push`
- `Search All Bookmarks` action

### Current behavior-sensitive functions

- `renameBookmark`
  - rethrows after toast so form stays open on failure
- `toggleFavorite`
  - catches failure and does not rethrow
- `moveBookmark`
  - removes item from list when moved away from a specific collection
- `deleteBookmark`
  - confirm first, remove locally only after successful API call
- `getMutationCollectionId`
  - throws when current view is All Bookmarks and raindrop lacks concrete collection ID
- `sortFavoriteFirst`
  - favorite bookmarks appear first
- `getMoveTargetCollections`
  - excludes current bookmark collection from move submenu

### UI details to preserve

- favorite star appears as right-side accessory, not main icon
- main icon remains cover/bookmark
- collection suggestions appear above bookmarks
- collection suggestion item detail says press Enter to search inside collection
- dropdown sections remain unchanged
- action panel sections remain unchanged

## Risks

### Circular imports

Likely risk after component extraction.

Mitigation:

- Keep dependency direction simple:

```txt
types/constants -> no app imports
utils/api -> import types/constants only
components -> import types/utils/constants
RaindropBookmarks -> imports components/utils/api
raindrop.tsx -> imports RaindropBookmarks only
```

- Avoid `CollectionSuggestionsSection` importing `raindrop.tsx`.
- Pass target factories for recursive `Action.Push` targets.

### Hook dependency regressions

If hooks are extracted too early, effects may reload too often or not enough.

Mitigation:

- Do not extract hooks in the first implementation unless needed.
- Preserve `refreshToken` dependency behavior.

### Type-only imports / isolated modules

`tsconfig.json` uses `isolatedModules: true`.

Mitigation:

- Use `import type` for types.
- Ensure every new file imports or exports something.

### Vicinae entrypoint detection

If `src/raindrop.tsx` becomes too thin or only re-exports, `vici build` should still work, but verify.

Mitigation:

- If direct re-export fails, use explicit import + default export wrapper.

### Behavior drift during helper extraction

Pure helpers have subtle behavior:

- collection title/path handling currently uses `"Parent / Child"` string mutation
- real collection titles containing `/` can be ambiguous, but this is current behavior
- markdown escaping only escapes `]`

Mitigation:

- Move code as-is first.
- Do not “fix” these behaviors in refactor unless separately approved.

## Edge Cases to Validate Manually

After implementation, if Vicinae dev mode is available:

1. Extension opens and loads bookmarks.
2. Collection dropdown works and clears search.
3. Typing a collection name shows suggestions.
4. Pressing Enter on a collection suggestion pushes into that collection.
5. `Escape` returns to previous pushed view.
6. Favorite bookmarks still sort to top.
7. Favorite star still appears on the right side.
8. Rename form opens, validates empty title, and pops after success.
9. Copy URL / Copy Title / Copy Markdown Link still exist.
10. Move to Collection submenu still excludes All Bookmarks, Trash, selected collection, and bookmark’s current collection.
11. Move to Trash / Delete Permanently labels remain correct.
12. API failure toasts still appear and do not falsely mutate state.

## Verification Commands

Run after every major phase:

```bash
npm run format
npm run lint
npm run build
```

Optional manual run:

```bash
npm run dev
```

No automated test suite currently exists.

## Possible Future Improvements After Refactor

These are intentionally deferred:

1. Add unit tests for pure helpers after extraction.
2. Add a `typecheck` script, e.g. `tsc --noEmit`, if it works cleanly with Vicinae setup.
3. Replace string-mutated child collection titles with a richer collection view model:

```ts
type CollectionView = {
  collection: Collection;
  displayName: string;
  path: string;
};
```

4. Replace long `Move to Collection` submenu with a searchable pushed picker.
5. Split refresh behavior into collection refresh and bookmark refresh if collection counts do not need reloading after every mutation.

## Implementation-Ready Handoff Summary

Approved scope for a future worker:

- Refactor only.
- Preserve all current behavior.
- Split `src/raindrop.tsx` into modules/components as planned.
- Keep `src/raindrop.tsx` as default-export command entrypoint.
- Prefer phased extraction: pure helpers/types/constants first, then main component wrapper, then presentational components.
- Avoid broad hook extraction unless it can be done without changing behavior.
- Run `npm run format`, `npm run lint`, and `npm run build`.

## Open Questions

1. Should the implementation stop after Phase 3, or should hook extraction also be included in the first refactor?
   - Recommendation: stop after Phase 3.
2. Should we add tests for extracted pure helpers during this refactor?
   - Recommendation: not in the first refactor unless explicitly approved, because the request is architecture/refactor and the project has no current test setup.
3. Should child collection title/path handling be improved now?
   - Recommendation: no; preserve current behavior first, then improve with a separate plan.

## Approval Gate

Please approve or adjust this plan before implementation.
