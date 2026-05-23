# Context brief: adding Raindrop.io mutating actions

## Current repo / command shape
- Single source file: `src/raindrop.tsx`.
- `package.json:12-19` declares one view command, `raindrop`; no separate create/edit command exists.
- `package.json:21-29` has one required password preference, `apiToken`.
- Runtime deps: `@vicinae/api` `^0.8.2` in manifest, installed `0.8.5` per `package-lock.json:714-716`; React `18.3.1`. Scripts: `npm run build`, `npm run lint`, `npm run format` at `package.json:30-34`.
- `tsconfig.json:4-17`: strict TS, `isolatedModules`, `jsx: react-jsx`, `lib: [es2020, dom]`, `module: commonjs`, `types: [node]`. Browser `fetch` is available via DOM lib.

## Existing implementation / symbols
- `src/raindrop.tsx:1-10`: imports `Action`, `ActionPanel`, `getPreferenceValues`, `Icon`, `List`, `showToast`, `Toast` from `@vicinae/api`; React hooks only.
- Types:
  - `Preferences` at `src/raindrop.tsx:12-14`.
  - `Raindrop` at `src/raindrop.tsx:16-26`: `_id`, `title`, `link`, optional `excerpt`, `domain`, `cover`, `tags`, `created`, `lastUpdate`.
  - `Collection` at `src/raindrop.tsx:28-35`: `_id`, `title`, optional `count`, `parent.$id`.
  - Response types at `src/raindrop.tsx:37-48` only cover list/read responses.
- Constants: `RAINDROP_API_BASE_URL = "https://api.raindrop.io/rest/v1"` (`src/raindrop.tsx:50`); built-ins `0` All, `-1` Unsorted, `-99` Trash (`src/raindrop.tsx:53-57`).
- Component state in `RaindropBookmarks` (`src/raindrop.tsx:63-76`): list data, collections, selected collection, search text, loading flags, error, `refreshToken`.
- Existing request helper (`src/raindrop.tsx:78-93`) only supports GET-style calls: accepts a path, calls `fetch(base + path, { headers: { Authorization } })`, throws on non-OK with status only, returns JSON typed as `T`.
  - For mutations, this likely needs to become `request<T>(path, init?)`, merge headers, add `Content-Type: application/json` when sending JSON, and parse/display API `errorMessage` when possible.
- Load collections (`src/raindrop.tsx:95-146`): `GET /collections` and `GET /collections/childrens` in parallel; failure toast but no blocking error UI.
- Load bookmarks (`src/raindrop.tsx:148-190`): `GET /raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true`; sets `error`; refresh triggered by incrementing `refreshToken`.
- Collection/navigation patterns:
  - Child collection display titles are prefixed with parent: `Parent / Child` (`src/raindrop.tsx:192-203`).
  - `allCollections` merges built-ins + root + child and de-dupes by `_id` (`src/raindrop.tsx:205-213`, `393-402`).
  - Collection suggestions appear when search text length >= 2 and are scored by helper functions (`src/raindrop.tsx:223-241`, `404-427`).
  - Dropdown changes collection and clears search (`src/raindrop.tsx:243-246`).
  - Search suggestion items use `Action.Push` to a new `RaindropBookmarks initialCollectionId=...` (`src/raindrop.tsx:322-333`).
- Current item actions (`src/raindrop.tsx:356-380`): open bookmark, copy URL, copy title, refresh, push Search All Bookmarks. No mutation actions yet.
- Detail markdown helper (`src/raindrop.tsx:454-468`) shows title, excerpt, URL, tags, created.

## Installed Vicinae API capabilities relevant to actions/forms
- `Action` typings (`node_modules/@vicinae/api/dist/api/components/actions.d.ts:7-52`):
  - Base action supports `title`, optional `icon`, `shortcut`, `autoFocus`, `style?: "regular" | "destructive"`.
  - `Action` takes synchronous `onAction: () => void` in typings; async functions can still be invoked via `void handler()` inside.
  - Available compound actions: `CopyToClipboard`, `Push`, `Open`, `Paste`, `SubmitForm`, `OpenInBrowser`.
  - `Action.SubmitForm` takes `onSubmit: (input: Form.Values) => boolean | void | Promise<boolean | void>`.
- `ActionPanel` (`node_modules/@vicinae/api/dist/api/components/action-pannel.d.ts:1-17`) supports root panel, `ActionPanel.Section`, and `ActionPanel.Submenu` with `onSearchTextChange` and children.
- `Form` (`node_modules/@vicinae/api/dist/api/components/form.d.ts:2-80`) supports props `actions`, `enableDrafts`, `isLoading`, `navigationTitle`, and items `TextField`, `PasswordField`, `DatePicker`, `Checkbox`, `Dropdown`, `Separator`. No `TextArea` or `TagPicker` component is actually exported despite namespace aliases; use `TextField` for short fields/tags, or verify before adding richer fields.
  - `Form.Value` can be `string | number | boolean | string[] | number[] | Date | null`; `Action.SubmitForm` returns `Form.Values` keyed by field id.
  - `Form.Dropdown` supports `filtering`, `isLoading`, `placeholder`, `onSearchTextChange`.
- Navigation: `useNavigation()` returns `push(node)` and `pop()` (`node_modules/@vicinae/api/dist/api/hooks/use-navigation.d.ts:1-4`). Useful for popping form after successful add/edit.
- Toasts: `showToast` can accept either positional `(Toast.Style, title, message)` or an options object; returns mutable `Toast` whose `style`, `title`, `message` can be updated (`node_modules/@vicinae/api/dist/api/toast.d.ts:20-66`, `92-159`). Use animated toast during network mutations.
- Alerts: `confirmAlert(options)` returns `Promise<boolean>`; supports destructive action style (`node_modules/@vicinae/api/dist/api/alert.d.ts:2-22`). Use before delete/trash/permanent destructive operations.
- Keyboard shortcuts: `Keyboard.Shortcut` exists and `Keyboard.Shortcut.Common.Copy/CopyName` only (`node_modules/@vicinae/api/dist/api/keyboard.d.ts:1-10`). If adding shortcuts, import `Keyboard` and specify literals, e.g. `{ modifiers: ["cmd"], key: "n" }`.

## Likely Raindrop.io mutation surface (verify against docs during implementation)
No web_search tool was available in this environment, so these endpoint details should be verified before coding against production. Based on the existing v1 REST base and common Raindrop.io API shape:
- Create bookmark: `POST /raindrop` with JSON body likely containing `link`, optional `title`, `excerpt`, `tags`, and `collection: { "$id": collectionId }`.
- Update bookmark: `PUT /raindrop/{id}` with JSON body for changed `title`, `link`, `excerpt`, `tags`, `collection: { "$id": collectionId }`.
- Delete bookmark: `DELETE /raindrop/{id}`. Confirm whether this moves to Trash or permanently deletes; if only trashing, a separate permanent-delete path may exist.
- Move bookmark can likely be implemented as update with `collection: { "$id": targetCollectionId }`; avoid allowing moves to virtual collection `0` (All) and consider whether `-99` Trash should be represented by Delete instead of update.
- Response shape likely contains `result: boolean`, maybe `item`, `errorMessage`; add a generic mutation response type and inspect `result`.

## High-value implementation approach
1. Refactor request helper, not duplicate fetch logic:
   - Change `request` to accept `RequestInit` and always include Authorization.
   - Preserve existing GET callers.
   - For JSON mutations, set `method`, `headers: { "Content-Type": "application/json" }`, and `body: JSON.stringify(payload)`.
   - Improve error extraction: if `response.ok` is false, try `await response.json()` and include `errorMessage` before falling back to `Raindrop.io API returned ${status}`.
2. Add mutating helpers inside `RaindropBookmarks` or top-level factory using current `request`:
   - `createRaindrop(values)` / `updateRaindrop(id, values)` / `deleteRaindrop(id)` / `moveRaindrop(id, collectionId)`.
   - After success: increment `refreshToken`; for edit/move/delete update local state optimistically or rely on refresh. If relying on refresh, at least remove deleted/moved-away items locally for snappy UI.
   - Collections counts are stale after mutations; current refresh token reloads both collections and bookmarks (`void refreshToken` in both effects), so incrementing it refreshes counts too.
3. Add forms using existing UI patterns:
   - Import `Form`, `useNavigation`, optionally `confirmAlert`, `Alert`, `Keyboard`.
   - A reusable `RaindropForm` component can receive `mode`, `initialRaindrop?`, `collections`, `selectedCollectionId`, `onSubmit` callback.
   - Use `Action.Push` from list/action panel to push create/edit form, or `useNavigation().push` in handler. Existing code already uses `Action.Push` for navigation.
   - Fields: URL/link (required for create/edit), title, excerpt, tags as comma-separated text (parse trim/filter), collection dropdown. Avoid using unavailable `Form.TextArea`/`Form.TagPicker` unless typings are confirmed.
   - On successful submit, show success toast and `pop()` back to list.
4. Actions to add in item panel:
   - `Edit Bookmark` -> form pre-filled from `raindrop`.
   - `Move to Collection` -> submenu or form/dropdown. Use only real root/child collections and Unsorted (`-1`) as targets; exclude current collection; exclude All (`0`) because virtual; treat Trash (`-99`) as destructive/delete unless API docs confirm update-to-trash is supported.
   - `Delete Bookmark` / `Move to Trash` -> destructive action with `style={Action.Style.Destructive}` and `confirmAlert`.
   - `Add Bookmark` should be available as a list-level action (Vicinae `List` has `actions?: ReactNode` per list typings) and/or in each item panel; preselect current collection unless current is All/Trash.
5. Add list-level actions to `List` via its `actions` prop if supported by runtime (`node_modules/@vicinae/api/dist/api/components/list.d.ts:8-20` includes `actions?: React.ReactNode`). Existing file does not use it yet.

## Edge cases / constraints to handle
- API token failures: existing request throws generic status. Mutations should show API error messages if available.
- Current collection can be built-in/virtual:
  - `0` All Bookmarks: should not be used as create/move collection target unless docs allow; default create target should probably be `-1` Unsorted or first real collection.
  - `-1` Unsorted is a real target in Raindrop API.
  - `-99` Trash is destructive context; do not offer create into trash; delete action label may need to become permanent delete when already viewing Trash only if API supports it.
- `Action` `onAction` is typed sync; use wrapper `onAction={() => void doMutation()}` for async deletion/move.
- Need prevent double-submit during form/mutation: maintain `isSubmitting`/toast state or disable via `Form isLoading` if possible.
- Form values are loosely typed (`Form.Values`), so narrow/cast safely and validate required strings at submit.
- `tags` currently optional string array and used for keywords/detail. Parse comma-separated user input into `string[]`; preserve empty array vs undefined according to API docs.
- Existing fetch list is capped to 50 (`src/raindrop.tsx:157-159`); after adding a bookmark, it may not appear if sorting/filter/current collection differ.
- Nested collection title strings contain `/`; do not send title to API for movement, send `_id`.
- Current collection suggestions and pushed nested views create multiple component instances; mutation helpers should be instance-local and refresh only the current view unless a broader cache/state is introduced.
- There are no tests. Avoid adding large dependencies; keep implementation in `src/raindrop.tsx` unless it becomes unwieldy.

## Validation checks
- Static/build:
  - `npm run lint` (Biome check on `src`).
  - `npm run build` (Vicinae build + TypeScript/bundling).
- Manual with a real Raindrop token:
  - Load command and verify existing browsing/search/dropdown still works.
  - Create bookmark from All view: should default to Unsorted or a selected real collection, show success, refresh list/counts.
  - Create bookmark from a real collection: created bookmark should appear in that collection after refresh.
  - Edit title/excerpt/tags/link; verify detail markdown and copy/open actions reflect updated data.
  - Move from one collection to another; verify item disappears from old collection and appears in target; counts refresh.
  - Delete from a normal collection: confirm alert appears, cancellation does nothing, confirmation removes/trashes and refreshes.
  - Try invalid URL / missing URL / API 401 token and verify clear failure toast and no navigation pop on failure.
  - If viewing Trash, verify available destructive behavior matches API docs (move-to-trash vs permanent delete).

## Compact implementation meta-prompt
Goal: Add Raindrop.io mutating actions to the existing Vicinae extension in `src/raindrop.tsx`: create bookmark, edit bookmark, move bookmark to another collection, and delete/trash bookmark, while preserving current browse/search/navigation behavior.

Context/evidence: The app is a single strict TS React file. Current request helper at `src/raindrop.tsx:78-93` only does authorized GETs; loads collections at `95-146` and bookmarks at `148-190`; refresh is driven by `refreshToken` and reloads both collections and raindrops. Current item actions are read-only at `356-380`. Collections include virtual built-ins `0` All, `-1` Unsorted, `-99` Trash at `53-57`; all real/nested collections are merged in `205-213`. Installed Vicinae `@vicinae/api` 0.8.5 supports `Form`, `Action.SubmitForm`, `Action.Push`, `ActionPanel.Section/Submenu`, `useNavigation`, `showToast`, and `confirmAlert` per typings cited above. `Form.TextArea`/`TagPicker` are not exported; use `Form.TextField` and `Form.Dropdown` unless verified otherwise.

Success criteria: Users can add a bookmark, edit an existing bookmark's URL/title/excerpt/tags/collection, move an existing bookmark to another valid collection, and delete/trash with confirmation. Successful mutations show success feedback and refresh affected list/collection counts. Failed mutations show API-aware failure toasts and do not falsely pop forms. Existing open/copy/refresh/search-all and collection suggestion navigation remain functional. Code passes `npm run lint` and `npm run build`.

Hard constraints: Do not add unverified dependencies. Keep using the existing `apiToken` preference and `RAINDROP_API_BASE_URL`. Do not use `Form.TextArea` or `Form.TagPicker` unless the installed typings/runtime are updated. Do not treat virtual collection `0` as a move/create destination; handle `-1` Unsorted and `-99` Trash deliberately.

Suggested approach: Generalize `request<T>(path, init?)` with Authorization/header merging and JSON error extraction. Add typed mutation response/payload helpers for `POST /raindrop`, `PUT /raindrop/{id}`, `DELETE /raindrop/{id}` after verifying exact API docs. Build a small reusable form component with text fields for link/title/excerpt/tags and a dropdown of valid destination collections; parse tags from comma-separated text. Add list-level Add action via `List actions`. Add item Edit, Move, Delete actions in sections/submenus, using animated/success/failure toasts, `confirmAlert` for delete, and `setRefreshToken((n) => n + 1)` after success.

Validation: Run `npm run lint` and `npm run build`; then manually test create/edit/move/delete/cancel/failure cases with a real token as listed in Validation checks. If API docs contradict the assumed endpoints/semantics, adapt endpoints and labels before implementation.

Stop/escalation: Stop and ask for a decision if product scope is ambiguous between “move to trash” and “permanent delete”, or if Raindrop API docs require OAuth scopes/tokens beyond the existing API token preference. Stop after build/lint pass and manual test notes are documented.
