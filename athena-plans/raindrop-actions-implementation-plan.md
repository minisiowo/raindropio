# Raindrop.io Vicinae Extension — Bookmark Actions Implementation Plan

## Status

Plan-only artifact. No source/config/test files should be edited until this plan is approved.

## Goal

Add mutating bookmark actions to the existing Vicinae extension while preserving current browsing/search/navigation behavior:

1. Copy Markdown link.
2. Rename bookmark.
3. Move bookmark to Trash / delete permanently from Trash.
4. Mark/unmark bookmark as favorite (`important`).
5. Move bookmark to a collection.

## Repository Evidence

Current implementation is concentrated in one file:

- `src/raindrop.tsx`
  - imports Vicinae primitives from `@vicinae/api`.
  - defines `Raindrop`, `Collection`, `RaindropsResponse`, `CollectionsResponse`.
  - `RaindropBookmarks` owns state, API calls, collection suggestions, list UI, and bookmark item actions.
  - `request<T>(path)` currently supports only authenticated GET-style calls.
  - bookmark loading uses `/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true`.
  - collection loading uses `/collections` and `/collections/childrens`.
  - current bookmark actions are read-only: open, copy URL, copy title, refresh, search all bookmarks.
- `package.json`
  - one view command: `raindrop`.
  - preference `apiToken` already exists as password.
  - scripts available: `npm run format`, `npm run lint`, `npm run build`.
- Installed `@vicinae/api` typings show these available integration points:
  - `Action.Push`
  - `Action.SubmitForm`
  - `Form.TextField`
  - `Form.Dropdown`
  - `useNavigation().pop()`
  - `confirmAlert`
  - `Alert.ActionStyle.Destructive`
  - `Action.Style.Destructive`

## External API Evidence

From Raindrop.io docs via Context7:

- Auth uses:

```http
Authorization: Bearer <token>
```

- Update single raindrop:

```http
PUT https://api.raindrop.io/rest/v1/raindrop/{id}
```

- Update many raindrops:

```http
PUT https://api.raindrop.io/rest/v1/raindrops/{collectionId}
```

Supports body fields including:

```json
{
  "ids": [123],
  "important": true,
  "tags": ["tag"],
  "collection": { "$id": 456 }
}
```

- Remove many raindrops:

```http
DELETE https://api.raindrop.io/rest/v1/raindrops/{collectionId}
```

With body:

```json
{
  "ids": [123]
}
```

Docs say deletion moves normal raindrops to Trash, while deleting from Trash permanently removes them. Use `collectionId = -99` for permanent removal semantics.

## Proposed Implementation Path

### Phase 1 — Types and API helper

File: `src/raindrop.tsx`

#### Update imports

Add Vicinae APIs needed for forms/alerts/navigation:

- `Alert`
- `confirmAlert`
- `Form`
- `useNavigation`

Current import block should become the integration point.

#### Extend `Raindrop`

Add fields needed for actions:

```ts
important?: boolean;
collection?: { $id: number };
```

Potentially add later if API responses require it:

```ts
note?: string;
type?: string;
```

#### Add generic mutation response type

```ts
type MutationResponse = {
  result: boolean;
  modified?: number;
  item?: Raindrop;
  errorMessage?: string;
};
```

#### Generalize `request`

Current symbol:

```ts
const request = useCallback(async <T,>(path: string) => { ... }, [apiToken]);
```

Change to accept options:

```ts
const request = useCallback(
  async <T,>(path: string, init?: RequestInit) => { ... },
  [apiToken],
);
```

Requirements:

- Always include `Authorization`.
- Merge caller-provided headers.
- Add `Content-Type: application/json` for JSON mutations.
- Parse JSON response when present.
- On non-OK, try to surface `errorMessage` from Raindrop API.
- Preserve existing GET behavior.

Recommended helper:

```ts
function jsonRequestInit(method: string, body: unknown): RequestInit
```

or inline per mutation.

### Phase 2 — Mutating helpers inside `RaindropBookmarks`

Keep helpers inside `RaindropBookmarks` initially so they can use `request`, `selectedCollectionId`, `setRaindrops`, `setRefreshToken`, and `showToast` without introducing global state.

#### `refresh()`

Small helper around current pattern:

```ts
const refresh = useCallback(() => {
  setRefreshToken((current) => current + 1);
}, []);
```

Use it instead of repeating the increment.

#### `updateBookmark(id, payload)`

Endpoint:

```http
PUT /raindrop/{id}
```

Use for:

- rename title
- optional future description/link edits

After success:

- update local `raindrops` optimistically if easy
- call `refresh()` to sync counts/data
- show success toast

#### `updateBookmarks(payload)`

Endpoint:

```http
PUT /raindrops/{selectedCollectionId}
```

Use for:

- favorite/unfavorite:

```json
{ "ids": [id], "important": true }
```

- move to collection:

```json
{ "ids": [id], "collection": { "$id": targetCollectionId } }
```

Important: if current `selectedCollectionId` is `0` (All Bookmarks), verify whether batch update accepts `0`. If not, fallback to `PUT /raindrop/{id}` for move/favorite. The plan should prefer single-raindrop `PUT /raindrop/{id}` for rename, and batch endpoint for documented `important`/`collection` updates only if confirmed during implementation.

#### `deleteBookmark(raindrop)`

Endpoint:

```http
DELETE /raindrops/{collectionId}
```

Body:

```json
{ "ids": [raindrop._id] }
```

Collection ID logic:

- If `selectedCollectionId === "-99"`, label action as `Delete Permanently` and call `DELETE /raindrops/-99`.
- Otherwise label as `Move to Trash` and call `DELETE /raindrops/{selectedCollectionId}`.
- If `selectedCollectionId === "0"`, verify docs/runtime behavior. If `DELETE /raindrops/0` fails, fallback may need current `raindrop.collection?.$id` or single delete endpoint if supported.

Use `confirmAlert` before request.

### Phase 3 — Copy Markdown Link

File: `src/raindrop.tsx`

Integration point: bookmark `ActionPanel` inside `raindrops.map(...)`.

Add:

```tsx
<Action.CopyToClipboard
  title="Copy Markdown Link"
  content={getMarkdownLink(raindrop)}
/>
```

Add helper:

```ts
function getMarkdownLink(raindrop: Raindrop) {
  return `[${escapeMarkdownLinkText(raindrop.title || raindrop.link)}](${raindrop.link})`;
}
```

Edge cases:

- Titles containing `]` should be escaped.
- URL can be used as title fallback.

### Phase 4 — Rename Bookmark Form

Add a small component in `src/raindrop.tsx`, below `RaindropBookmarks` or near helper components:

```tsx
type RenameBookmarkFormProps = {
  raindrop: Raindrop;
  onRename: (id: number, title: string) => Promise<void>;
};

function RenameBookmarkForm({ raindrop, onRename }: RenameBookmarkFormProps) { ... }
```

Use:

- `Form`
- `Form.TextField id="title" defaultValue={raindrop.title}`
- `Action.SubmitForm`
- `useNavigation().pop()` after successful submit
- `isLoading` state while submitting

Action integration:

```tsx
<Action.Push
  title="Rename Bookmark"
  icon={Icon.Pencil}
  target={<RenameBookmarkForm raindrop={raindrop} onRename={renameBookmark} />}
/>
```

Validation:

- Empty title should show failure toast or form error and not submit.
- Keep URL fallback only for display, not as renamed title unless user chooses it.

### Phase 5 — Delete / Move to Trash

Add destructive action in bookmark `ActionPanel`, preferably in a destructive section:

```tsx
<Action
  title={selectedCollectionId === "-99" ? "Delete Permanently" : "Move to Trash"}
  icon={Icon.Trash}
  style={Action.Style.Destructive}
  onAction={() => void deleteBookmark(raindrop)}
/>
```

Use `confirmAlert`:

```ts
const confirmed = await confirmAlert({
  title: selectedCollectionId === "-99" ? "Delete Permanently?" : "Move to Trash?",
  message: raindrop.title || raindrop.link,
  primaryAction: {
    title: selectedCollectionId === "-99" ? "Delete Permanently" : "Move to Trash",
    style: Alert.ActionStyle.Destructive,
  },
});
```

After success:

- Optimistically remove item from `raindrops`:

```ts
setRaindrops((items) => items.filter((item) => item._id !== raindrop._id));
```

- Call `refresh()`.
- Show toast.

Edge cases:

- Cancellation must do nothing.
- API failure should keep item visible and show failure toast.
- Trash view label must be clearly permanent/destructive.

### Phase 6 — Favorite / Unfavorite

Extend item actions with:

```tsx
<Action
  title={raindrop.important ? "Unmark as Favorite" : "Mark as Favorite"}
  icon={raindrop.important ? Icon.StarDisabled /* verify */ : Icon.Star}
  onAction={() => void toggleFavorite(raindrop)}
/>
```

Before implementation, verify icon names in `node_modules/@vicinae/api/dist/api/icon.d.ts`. If no disabled star exists, use `Icon.Star` for both.

Mutation payload:

```json
{
  "ids": [123],
  "important": true
}
```

After success:

- Optimistically update item:

```ts
setRaindrops((items) =>
  items.map((item) =>
    item._id === raindrop._id ? { ...item, important: !raindrop.important } : item,
  ),
);
```

- Call `refresh()` in background to sync.

Edge cases:

- API response may not include updated `item`; do not depend on it.
- If the current response does not include `important`, default false.

### Phase 7 — Move to Collection

Recommended first implementation: submenu, not form dropdown.

Reason: installed `@vicinae/api` typings expose `Form.Dropdown`, but do not expose `Form.Dropdown.Item`/`Section`. `List.Dropdown.Item` exists, but form dropdown item typing is uncertain. A submenu is simpler and should type-check.

Integration:

```tsx
<ActionPanel.Submenu title="Move to Collection" icon={Icon.Folder}>
  {moveTargetCollections.map((collection) => (
    <Action
      key={collection._id}
      title={getCollectionTitle(collection)}
      onAction={() => void moveBookmark(raindrop, collection)}
    />
  ))}
</ActionPanel.Submenu>
```

Move targets:

- Include root collections.
- Include nested collections.
- Include `Unsorted` (`-1`).
- Exclude `All Bookmarks` (`0`) because it is virtual.
- Exclude `Trash` (`-99`) from move submenu; use destructive delete/trash action instead.
- Exclude the currently selected real collection if possible.

Add memo:

```ts
const moveTargetCollections = useMemo(
  () => allCollections.filter(isMoveTargetCollection),
  [allCollections],
);
```

Mutation payload:

```json
{
  "ids": [123],
  "collection": { "$id": 456 }
}
```

After success:

- If currently viewing a specific collection, remove moved item from current list unless moving within same collection.
- If viewing All Bookmarks, item can remain visible but refresh should update metadata/counts.
- Show toast `Moved to <collection>`.

Potential later improvement:

- Replace submenu with searchable move view using `Action.Push` and `List`, similar to current collection suggestions, if the collection list becomes too long.

### Phase 8 — ActionPanel organization

Current item action panel is flat. Reorganize for usability:

```tsx
<ActionPanel>
  <ActionPanel.Section title="Open">
    <Action.OpenInBrowser ... />
  </ActionPanel.Section>

  <ActionPanel.Section title="Copy">
    <Action.CopyToClipboard title="Copy URL" ... />
    <Action.CopyToClipboard title="Copy Title" ... />
    <Action.CopyToClipboard title="Copy Markdown Link" ... />
  </ActionPanel.Section>

  <ActionPanel.Section title="Edit">
    <Action.Push title="Rename Bookmark" ... />
    <Action title="Mark as Favorite" ... />
    <ActionPanel.Submenu title="Move to Collection" ... />
  </ActionPanel.Section>

  <ActionPanel.Section title="Navigation">
    <Action title="Refresh" ... />
    <Action.Push title="Search All Bookmarks" ... />
  </ActionPanel.Section>

  <ActionPanel.Section title="Danger Zone">
    <Action title="Move to Trash" style={Action.Style.Destructive} ... />
  </ActionPanel.Section>
</ActionPanel>
```

This keeps destructive actions visually separated.

## Exact Files to Change During Implementation

Only after approval:

1. `src/raindrop.tsx`
   - imports
   - types
   - `request` helper
   - mutation helpers
   - bookmark `ActionPanel`
   - new helper component `RenameBookmarkForm`
   - helper functions: markdown link escaping, move target filtering, response validation

No package/config changes are expected unless typings reveal a missing dependency, which is unlikely.

## Risks and Edge Cases

### API semantics

- `DELETE /raindrops/0` may or may not work for deleting from All Bookmarks.
- Permanent deletion from Trash must be verified with the actual API behavior.
- Batch `PUT /raindrops/{collectionId}` may behave differently for virtual collection `0`.

Mitigation:

- Prefer documented endpoints.
- Surface API error messages.
- Keep destructive action behind confirmation.
- If a virtual collection endpoint fails, adapt to single-raindrop endpoint or `raindrop.collection?.$id` if available.

### Vicinae API limitations

- `Form.Dropdown.Item` is not present in installed typings.
- `Action` typing declares sync `onAction`, so async handlers should be wrapped:

```tsx
onAction={() => void deleteBookmark(raindrop)}
```

### UX issues

- Move submenu may be long for users with many collections.
- Searchable move view may be better later, but submenu is safer for initial implementation.
- Rename-only form is intentionally narrow; full edit form can be added later.

### Data refresh

- Optimistic updates may conflict with subsequent refresh if API data differs.
- Existing `refreshToken` reloads collections and raindrops; keep using it for consistency.

### Trash/permanent delete

- User must see clear label difference:
  - outside Trash: `Move to Trash`
  - inside Trash: `Delete Permanently`

## Verification Commands

Run after implementation:

```bash
npm run format
npm run lint
npm run build
```

Expected:

- `biome` passes.
- `vici build` passes type checking and bundles extension.

## Manual Verification Checklist

Using a real Raindrop.io token in Vicinae preferences:

1. Existing flows still work:
   - open command
   - browse All Bookmarks
   - search bookmarks
   - type collection name and enter collection through suggestion
   - `Escape` pops from pushed collection view
2. Copy actions:
   - Copy URL works
   - Copy Title works
   - Copy Markdown Link produces `[Title](URL)`
3. Rename:
   - open Rename Bookmark form
   - submit non-empty title
   - form pops after success
   - list/detail show new title after refresh
   - empty title is rejected
4. Favorite:
   - mark favorite
   - action label changes to unmark, or refresh reflects state
   - unmark favorite works
5. Move:
   - move bookmark to another real collection
   - item disappears from current collection if appropriate
   - target collection shows item after navigating there
   - All Bookmarks is not offered as a move target
   - Trash is not offered as normal move target
6. Trash/delete:
   - cancellation in confirmation does nothing
   - confirm outside Trash moves/removes from current list
   - in Trash, action label is `Delete Permanently`
   - failure toast appears if API rejects request
7. Error handling:
   - invalid/expired token shows failure toast
   - network/API failure does not falsely remove/pop data

## Suggested Implementation Order

1. Generalize `request` and add mutation response helpers.
2. Add `Copy Markdown Link` because it is low risk.
3. Add `RenameBookmarkForm` and `Rename Bookmark` action.
4. Add `Move to Trash` / `Delete Permanently` with confirmation.
5. Add favorite/unfavorite.
6. Add move-to-collection submenu.
7. Reorganize `ActionPanel` sections.
8. Run validation commands and manual checks.

## Open Questions / Assumptions

Assumptions:

- The current API token has write/delete permissions.
- `PUT /raindrop/{id}` accepts `{ "title": "..." }` for rename.
- Batch endpoints documented by Raindrop.io work with numeric IDs returned as `_id`.
- Submenu-based move UI is acceptable for the first implementation.

Open questions before or during implementation:

1. Should `Rename Bookmark` remain title-only, or should the first form also edit URL, excerpt, and tags?
2. Should `Move to Collection` be a simple submenu now, or should we immediately build a searchable pushed collection picker?
3. Should destructive delete from `All Bookmarks` use `DELETE /raindrops/0`, or should we first fetch/use the raindrop's concrete collection ID?
4. Should favorite state be visually shown in the list item, e.g. accessory/star, after adding `important`?

## Approval Gate

Do not implement until the user approves this plan or requests modifications.
