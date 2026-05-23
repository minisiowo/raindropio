# Code Context

## Files Retrieved
1. `package.json` (lines 1-45) - Vicinae extension manifest, command registration, preference schema, scripts, dependencies.
2. `tsconfig.json` (lines 1-18) - TypeScript scope and compiler settings.
3. `.gitignore` (lines 1-2) - ignored/generated areas.
4. `README.md` (lines 1-14) - basic install/dev/build usage.
5. `src/raindrop.tsx` (lines 1-3) - command entrypoint default export.
6. `src/components/RaindropBookmarks.tsx` (lines 1-445) - main feature container and Raindrop API/UI data flow.
7. `src/api/raindrop-api.ts` (lines 1-55) - API request helper and mutation result validation.
8. `src/types.ts` (lines 1-52) - project domain and API response types.
9. `src/constants.ts` (lines 1-13) - Raindrop collection IDs and API base URL.
10. `src/components/BookmarkActions.tsx` (lines 1-106) - bookmark item action panel.
11. `src/components/BookmarkListSection.tsx` (lines 1-66) - bookmark list rendering.
12. `src/components/CollectionDropdown.tsx` (lines 1-57) - collection filter dropdown.
13. `src/components/CollectionSuggestionsSection.tsx` (lines 1-44) - collection search suggestions.
14. `src/components/RenameBookmarkForm.tsx` (lines 1-70) - rename form and validation.
15. `src/utils/collections.ts` (lines 1-105) - collection normalization, title, filtering, and mutation helper logic.
16. `src/utils/errors.ts` (lines 1-3) - error message fallback helper.
17. `src/utils/markdown.ts` (lines 1-25) - bookmark markdown rendering/copy helpers.
18. `src/utils/raindrops.ts` (lines 1-8) - bookmark sorting helper.
19. `assets/extension_icon.png` - extension icon referenced by manifest.
20. `athena-plans/*.md` - planning/context artifacts, not runtime source.

## Key Code

No `AGENTS.md` files currently exist in the repository.

Project manifest and commands are in `package.json`:

```json
{
  "name": "raindropio",
  "title": "raindrop.io",
  "description": "Browse and search your Raindrop.io bookmarks from Vicinae.",
  "commands": [{ "name": "raindrop", "mode": "view" }],
  "preferences": [{ "name": "apiToken", "required": true, "type": "password" }],
  "scripts": {
    "build": "vici build",
    "dev": "vici develop",
    "format": "biome format --write src",
    "lint": "biome check src"
  },
  "dependencies": { "@vicinae/api": "^0.8.2", "react": "^18.3.1" },
  "devDependencies": { "typescript": "^5.9.2", "@types/react": "^18.3.12", "@biomejs/biome": "2.3.2" }
}
```

TypeScript scope is only `src/**/*` (`tsconfig.json:4`) with strict React JSX/CommonJS settings (`tsconfig.json:5-17`).

Command entrypoint is intentionally thin:

```ts
// src/raindrop.tsx:1-3
import RaindropBookmarks from "./components/RaindropBookmarks";

export default RaindropBookmarks;
```

Main container (`src/components/RaindropBookmarks.tsx`) owns preferences, state, loading, mutations, and composition:

```ts
// src/components/RaindropBookmarks.tsx:46-64
export default function RaindropBookmarks({
  initialCollectionId = ALL_BOOKMARKS_COLLECTION_ID.toString(),
}: RaindropBookmarksProps = {}) {
  const { apiToken } = getPreferenceValues<Preferences>();
  const [raindrops, setRaindrops] = useState<Raindrop[]>([]);
  const [rootCollections, setRootCollections] = useState<Collection[]>([]);
  const [childCollections, setChildCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollectionId);
  ...
  const request = useMemo(() => createRaindropRequest(apiToken), [apiToken]);
```

It fetches collections and bookmarks from Raindrop.io (`src/components/RaindropBookmarks.tsx:67-160`), derives collection/search data (`src/components/RaindropBookmarks.tsx:162-224`), performs mutations (rename/favorite/move/delete, `src/components/RaindropBookmarks.tsx:226-379`), and renders the Vicinae `List` (`src/components/RaindropBookmarks.tsx:398-445`).

API helper centralizes Authorization and JSON error extraction:

```ts
// src/api/raindrop-api.ts:4-25
export function createRaindropRequest(apiToken: string) {
  return async function request<T>(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${apiToken}`);
    const response = await fetch(`${RAINDROP_API_BASE_URL}${path}`, { ...init, headers });
    ...
    if (!response.ok) throw new Error(data?.errorMessage ?? `Raindrop.io API returned ${response.status}`);
    return (data ?? {}) as T;
  };
}
```

Core types live in `src/types.ts:1-52`: `Preferences`, `Raindrop`, `Collection`, `RaindropsResponse`, `CollectionsResponse`, `MutationResponse`, `RaindropBookmarksProps`.

## Architecture

- Purpose: a single Vicinae extension command that browses, searches, and mutates Raindrop.io bookmarks using a user-provided API token.
- Languages/frameworks: TypeScript, React 18 JSX, Vicinae API (`@vicinae/api`), Biome for lint/format, npm package management.
- Package boundaries:
  - Root manifest/config: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`.
  - Runtime source: `src/` only.
    - `src/raindrop.tsx`: Vicinae command entrypoint; should keep default export.
    - `src/api/`: external Raindrop API client helpers.
    - `src/components/`: React/Vicinae UI and action forms.
    - `src/utils/`: pure formatting/filtering/error helpers.
    - `src/types.ts` and `src/constants.ts`: shared domain contracts/constants.
  - Static assets: `assets/extension_icon.png`, referenced by `package.json` icon field as `extension_icon.png`.
  - Planning/output docs: `athena-plans/*.md`; not consumed by build/runtime.
- Build/test commands:
  - Install: `npm install`.
  - Development: `npm run dev` (`vici develop`).
  - Production build/type/bundle validation: `npm run build` (`vici build`).
  - Lint/static check: `npm run lint` (`biome check src`).
  - Format: `npm run format` (`biome format --write src`).
  - No test script is defined; no test files were found.
- Generated/vendor/ignored areas to avoid:
  - `node_modules/` is present and ignored; do not edit or add guidance there.
  - `vicinae-env.d.ts` is ignored/generated by Vicinae if present; not present in this checkout.
  - `package-lock.json` is generated/managed by npm; avoid manual edits unless changing dependencies through npm.
  - Potential Vicinae build artifacts are not visible in the repo; if generated, treat them as build output unless tracked intentionally.
- Existing generated/planning areas:
  - `athena-plans/` contains agent-produced plans/context. It is not vendor/generated in the build sense, but it is process documentation; avoid treating it as runtime source.

AGENTS.md guidance recommendation:

- A root `AGENTS.md` is warranted. It can cover the entire small repository with concise rules: keep `src/raindrop.tsx` as the command default-export entrypoint, use TypeScript/React/Vicinae patterns, run `npm run lint` and `npm run build`, avoid `node_modules`/generated files, and do not hand-edit `package-lock.json` except via npm.
- Nested `src/AGENTS.md`: not materially warranted now. The `src` subtree is only ~1k lines, one package, one language/framework, and already has clear folders. Root guidance can include source-specific notes.
- Nested `assets/AGENTS.md`: not warranted; single icon asset only.
- Nested `athena-plans/AGENTS.md`: not materially warranted unless maintainers want enforced formatting/retention rules for planning artifacts. Current repo can be served by root guidance that labels `athena-plans/` as non-runtime planning docs.
- Nested guidance for `node_modules/` or ignored generated areas: not warranted; should be explicitly avoided from root.

## Start Here

Start with `package.json` to understand the extension manifest, command name, scripts, dependencies, and API token preference. Then open `src/raindrop.tsx` and `src/components/RaindropBookmarks.tsx` to follow the Vicinae command entrypoint into the main data flow.
