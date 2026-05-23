# Code Context

## Files Retrieved
1. `src/raindrop.tsx` (lines 1-72) - imports, API/domain types, API constants, built-in collections.
2. `src/raindrop.tsx` (lines 78-215) - main `RaindropBookmarks` state, request wrapper, collections/bookmarks loading effects.
3. `src/raindrop.tsx` (lines 217-279) - derived collection models and collection search/suggestion logic.
4. `src/raindrop.tsx` (lines 281-434) - bookmark mutations: `renameBookmark`, `toggleFavorite`, `moveBookmark`, `deleteBookmark`.
5. `src/raindrop.tsx` (lines 436-641) - large List render tree, dropdown, collection suggestion items, bookmark items, action panel.
6. `src/raindrop.tsx` (lines 644-699) - `RenameBookmarkForm` component and inline submit validation.
7. `src/raindrop.tsx` (lines 701-860) - pure utilities for sorting, collection formatting/matching, mutation request helpers, error handling, markdown rendering.
8. `package.json` (lines 30-44) - validation/build scripts and dependencies.
9. `tsconfig.json` (lines 1-18) - strict TypeScript compiler settings, but no dedicated script invokes `tsc` directly.
10. `README.md` (lines 1-15) - starter readme only; no extra validation/refactor constraints documented.

## Key Code

- `src/raindrop.tsx` is the only source file and is 860 lines. It currently combines API transport, domain types, data fetching, mutation workflows, view state, list rendering, form rendering, and utility functions.

```tsx
// src/raindrop.tsx:78-91
export default function RaindropBookmarks({ initialCollectionId = "0" }: RaindropBookmarksProps = {}) {
  const { apiToken } = getPreferenceValues<Preferences>();
  const [raindrops, setRaindrops] = useState<Raindrop[]>([]);
  const [rootCollections, setRootCollections] = useState<Collection[]>([]);
  const [childCollections, setChildCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollectionId);
  const [searchText, setSearchText] = useState("");
  const [isLoadingRaindrops, setIsLoadingRaindrops] = useState(true);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [error, setError] = useState<string>();
  const [refreshToken, setRefreshToken] = useState(0);
```

- API transport is local to the component, which makes mutation and data-loading code hard to share/test.

```tsx
// src/raindrop.tsx:93-116
const request = useCallback(async <T,>(path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${apiToken}`);
  const response = await fetch(`${RAINDROP_API_BASE_URL}${path}`, { ...init, headers });
  const responseText = await response.text();
  const data = parseJsonResponse(responseText) as (T & { errorMessage?: string }) | undefined;
  if (!response.ok) throw new Error(data?.errorMessage ?? `Raindrop.io API returned ${response.status}`);
  return (data ?? {}) as T;
}, [apiToken]);
```

- Loading is duplicated across two effects: mounted guard, loading state, `try/catch/finally`, toast formatting.
  - Collections: `src/raindrop.tsx:122-172`
  - Bookmarks: `src/raindrop.tsx:174-215`

- Mutation workflows share a repeated pattern: call `request`, `jsonRequestInit`, `ensureMutationResult`, update local state, `refresh`, toast failure/success.
  - `renameBookmark`: `src/raindrop.tsx:281-305`
  - `toggleFavorite`: `src/raindrop.tsx:307-344`
  - `moveBookmark`: `src/raindrop.tsx:346-389`
  - `deleteBookmark`: `src/raindrop.tsx:391-434`

- Main render tree is oversized and has multiple component boundaries embedded inline:
  - `List` container and dropdown: `src/raindrop.tsx:450-494`
  - collection suggestions section/items: `src/raindrop.tsx:496-526`
  - bookmark list items/actions: `src/raindrop.tsx:528-639`

- Existing separate component is only `RenameBookmarkForm`:

```tsx
// src/raindrop.tsx:649-699
function RenameBookmarkForm({ raindrop, onRename }: RenameBookmarkFormProps) {
  const { pop } = useNavigation();
  const [titleError, setTitleError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  // inline submit validation and action rendering
}
```

- Pure utilities are good extraction candidates:
  - collection/suggestion: `uniqueCollections`, `uniqueCollectionSuggestions`, `getCollectionMatchScore`, `getCollectionName`, `getCollectionSubtitle`, `formatBookmarkCount`, `getCollectionTitle`, `isMoveTargetCollection`, `getMoveTargetCollections` (`src/raindrop.tsx:712-793`)
  - mutation/api helpers: `getMutationCollectionId`, `jsonRequestInit`, `parseJsonResponse`, `ensureMutationResult`, `getErrorMessage` (`src/raindrop.tsx:795-835`)
  - markdown: `getMarkdownLink`, `escapeMarkdownLinkText`, `getMarkdown` (`src/raindrop.tsx:838-860`)

- Validation scripts currently available:

```json
// package.json:30-35
"scripts": {
  "build": "vici build",
  "dev": "vici develop",
  "format": "biome format --write src",
  "lint": "biome check src"
}
```

`npm run lint` passed (`biome check src`). `npm run build` passed and includes Vicinae type checking/build. There is no separate `typecheck` script and no repository-level `biome.json` config found.

## Architecture

Current flow in one file:

1. `RaindropBookmarks` reads `apiToken` from Vicinae preferences (`src/raindrop.tsx:81`).
2. It creates a generic authorized `request<T>()` wrapper against `RAINDROP_API_BASE_URL` (`src/raindrop.tsx:65`, `src/raindrop.tsx:93-116`).
3. Collections load via `/collections` and `/collections/childrens` on mount/refresh (`src/raindrop.tsx:122-172`). Root and child collections are stored separately, then child titles are rewritten with parent path information (`src/raindrop.tsx:217-228`).
4. Bookmarks load from `/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true` whenever selected collection or refresh token changes (`src/raindrop.tsx:174-215`). Results are sorted by `important` first (`src/raindrop.tsx:701-706`).
5. Derived UI data builds `allCollections`, `moveTargetCollections`, `selectedCollectionTitle`, and `collectionSuggestions` with several pure helper functions (`src/raindrop.tsx:230-274`).
6. Mutations call Raindrop API endpoints directly from component callbacks and update local state optimistically/locally, then increment `refreshToken` to reload both collections and bookmarks (`src/raindrop.tsx:281-434`).
7. UI renders a Vicinae `List` with a collection dropdown, optional collection suggestion section, bookmark items, detail markdown, and large inline `ActionPanel` (`src/raindrop.tsx:450-641`).
8. Rename uses a pushed form component (`src/raindrop.tsx:574-582`, `src/raindrop.tsx:649-699`).

Important coupling/risk points:

- `refresh()` reloads both collections and bookmarks because both effects depend on `refreshToken` (`src/raindrop.tsx:122-172`, `src/raindrop.tsx:174-215`). This is simple but coarse-grained; refactor should preserve behavior or intentionally split `refreshCollections`/`refreshRaindrops`.
- `getMutationCollectionId()` throws for all-bookmarks view if a raindrop has no `collection.$id` (`src/raindrop.tsx:795-805`). Mutations from collection `0` depend on response shape including `collection`.
- Built-in collection IDs are magic values (`0`, `-1`, `-99`) repeated in filtering/deletion/navigation (`src/raindrop.tsx:68-72`, `src/raindrop.tsx:393`, `src/raindrop.tsx:626-628`, `src/raindrop.tsx:779-782`). Prefer named constants/enum-like object before moving code.
- `Action.Push` for collection suggestions recursively mounts `RaindropBookmarks` (`src/raindrop.tsx:512-519`); if extracting components, keep command-level component default export intact.
- Markdown escaping only escapes `]`, not parentheses/backslashes/title headings (`src/raindrop.tsx:838-843`); not strictly a refactor item, but changing it could alter output.

Recommended decomposition plan:

1. **Create domain/types boundary**
   - New `src/types.ts` or `src/raindrop/types.ts` for `Preferences`, `Raindrop`, `Collection`, `RaindropsResponse`, `CollectionsResponse`, `MutationResponse` (`src/raindrop.tsx:16-63`).
   - Export named built-in collection constants from a constants module: `ALL_COLLECTION_ID = 0`, `UNSORTED_COLLECTION_ID = -1`, `TRASH_COLLECTION_ID = -99`, `BUILT_IN_COLLECTIONS`, `MAX_COLLECTION_SUGGESTIONS` (`src/raindrop.tsx:65-72`).

2. **Extract API client and endpoint methods**
   - New `src/api/raindrop.ts` or `src/lib/raindrop-api.ts` containing base request behavior (`src/raindrop.tsx:93-116`, `src/raindrop.tsx:808-831`).
   - Provide concrete methods: `fetchRootCollections`, `fetchChildCollections`, `fetchRaindrops(collectionId)`, `renameRaindrop`, `updateRaindrops`, `deleteRaindrops`.
   - Keep UI toasts outside the API client; API should throw typed/error messages only.

3. **Extract pure collection/bookmark utilities**
   - New `src/utils/collections.ts`: `normalize`, `uniqueCollections`, `uniqueCollectionSuggestions`, `getCollectionMatchScore`, `getCollectionName`, `getCollectionSubtitle`, `formatBookmarkCount`, `getCollectionTitle`, `isMoveTargetCollection`, `getMoveTargetCollections`, `getMutationCollectionId` (`src/raindrop.tsx:708-805`).
   - New `src/utils/raindrops.ts`: `sortFavoriteFirst` (`src/raindrop.tsx:701-706`).
   - New `src/utils/markdown.ts`: `getMarkdownLink`, `escapeMarkdownLinkText`, `getMarkdown` (`src/raindrop.tsx:838-860`).

4. **Extract data hooks**
   - New `useCollections(api, refreshKey)` for root/child loading and `allCollections`/child display titles. It should return `{ rootCollections, childCollections, childCollectionTitles, allCollections, isLoadingCollections, reloadCollections }`.
   - New `useRaindrops(api, selectedCollectionId, refreshKey)` for bookmark loading/error/loading state and setter/update helpers.
   - Optional combined `useRefreshToken()` hook to preserve existing refresh-token pattern.
   - Consider extracting repeated mounted-guard logic into a small hook or using an abort/cancel helper; the existing `let isMounted = true` duplication is in `src/raindrop.tsx:122-172` and `src/raindrop.tsx:174-215`.

5. **Extract mutation actions hook**
   - New `useBookmarkActions({ api, selectedCollectionId, setRaindrops, refresh })` returning `renameBookmark`, `toggleFavorite`, `moveBookmark`, `deleteBookmark`.
   - This would isolate repeated mutation error handling and keep the main component focused on state composition and rendering.
   - Be careful with `renameBookmark`: it rethrows after toast so `RenameBookmarkForm` can stay open (`src/raindrop.tsx:295-302`, `src/raindrop.tsx:674-679`). Preserve that behavior.

6. **Split UI components**
   - `CollectionDropdown` for `src/raindrop.tsx:459-494`; props: selected id, loading, built-ins, root collections, child collection titles, onChange.
   - `CollectionSuggestionsSection` and `CollectionSuggestionItem` for `src/raindrop.tsx:496-526`; keep `Action.Push` target behavior.
   - `BookmarkListSection`, `BookmarkListItem`, and/or `BookmarkActions` for `src/raindrop.tsx:528-639`; pass callbacks and derived move targets as props.
   - Move `RenameBookmarkForm` into `src/components/RenameBookmarkForm.tsx` (`src/raindrop.tsx:644-699`).
   - After extraction, `src/raindrop.tsx` should ideally become the command shell: preferences, hooks, derived suggestions/title, and top-level `List` composition.

7. **Validation improvements**
   - Keep `npm run lint` (`biome check src`) and `npm run build` (`vici build`) as minimum gates; both currently pass.
   - Add a `typecheck` script if Vicinae supports/permits direct TypeScript validation, e.g. `tsc --noEmit`, because `lint` does not explicitly run `tsc` and `build` has side effects/output outside the repo.
   - Consider adding tests for pure utilities after extraction, especially collection matching/deduplication and `getMutationCollectionId`, because those will be easiest to regress while moving code.

## Start Here

Start with `src/raindrop.tsx` lines 78-641. This is the main oversized component and contains the highest-value extraction seams: API request wrapper, duplicated load effects, mutation callbacks, collection dropdown, suggestion section, bookmark items, and actions.
