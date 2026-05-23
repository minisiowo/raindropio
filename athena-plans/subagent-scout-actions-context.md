# Code Context

## Files Retrieved
1. `src/raindrop.tsx` (lines 1-10) - current imports from `@vicinae/api`; lacks `Form`, `useNavigation`, `confirmAlert`, `Alert` imports needed for requested actions.
2. `src/raindrop.tsx` (lines 12-57) - local Raindrop/Collection/API response types and built-in collection IDs, including Trash `-99`.
3. `src/raindrop.tsx` (lines 63-93) - main component state and current `request<T>(path)` helper; only supports GET/no body.
4. `src/raindrop.tsx` (lines 95-190) - collection and bookmark loading flows; `refreshToken` drives reload after mutations.
5. `src/raindrop.tsx` (lines 192-246) - collection normalization/search/dropdown data (`allCollections`, `childCollectionTitles`, suggestions).
6. `src/raindrop.tsx` (lines 262-385) - current List UI and ActionPanel structure for collection suggestions and bookmarks.
7. `src/raindrop.tsx` (lines 389-468) - helper functions and `getMarkdown(raindrop)` detail rendering.
8. `package.json` (lines 1-33) - one view command `raindrop`, dependency `@vicinae/api ^0.8.2`.
9. `node_modules/@vicinae/api/dist/api/components/actions.d.ts` (lines 7-52) - available action props, including `Action.SubmitForm`, `Action.CopyToClipboard`, destructive style.
10. `node_modules/@vicinae/api/dist/api/components/action-pannel.d.ts` (lines 4-23) - `ActionPanel`, `ActionPanel.Section`, and `ActionPanel.Submenu` support.
11. `node_modules/@vicinae/api/dist/api/components/form.d.ts` (lines 2-80) - installed Form surface: `TextField`, `Checkbox`, `Dropdown`, `Separator`; no typed `Form.Dropdown.Item`/`Section` in this package version.
12. `node_modules/@vicinae/api/dist/api/components/list.d.ts` (lines 25-108) - `List`/`List.Dropdown` capabilities and currently used dropdown item/section typing.
13. `node_modules/@vicinae/api/dist/api/hooks/use-navigation.d.ts` (lines 1-4) - `push(node)` and `pop()` only.
14. `node_modules/@vicinae/api/dist/api/alert.d.ts` (lines 2-22) - `confirmAlert`, `Alert.ActionStyle.Destructive/Cancel` for confirmation dialogs.
15. `node_modules/@vicinae/api/dist/api/toast.d.ts` (lines 92-168) - `showToast` signatures, mutable toast, `showHUD`.

## Key Code

Current imports:
```ts
// src/raindrop.tsx lines 1-9
import {
  Action,
  ActionPanel,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
} from "@vicinae/api";
```

Current data types are minimal:
```ts
// src/raindrop.tsx lines 16-26
type Raindrop = {
  _id: number;
  title: string;
  link: string;
  excerpt?: string;
  domain?: string;
  cover?: string;
  tags?: string[];
  created?: string;
  lastUpdate?: string;
};
```
Likely need to add fields for actions, especially `important?: boolean` for favorite/unfavorite and possibly `collection?: { $id: number }` if current collection matters for move/delete logic.

Built-ins include trash:
```ts
// src/raindrop.tsx lines 53-57
const BUILT_IN_COLLECTIONS: Collection[] = [
  { _id: 0, title: "All Bookmarks" },
  { _id: -1, title: "Unsorted" },
  { _id: -99, title: "Trash" },
];
```

Current API helper is GET-only:
```ts
// src/raindrop.tsx lines 78-93
const request = useCallback(
  async <T,>(path: string) => {
    const response = await fetch(`${RAINDROP_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!response.ok) throw new Error(`Raindrop.io API returned ${response.status}`);
    return (await response.json()) as T;
  },
  [apiToken],
);
```
For mutations, this likely becomes `request<T>(path, init?)` or a separate `mutateRaindrop` helper that adds `method`, `Content-Type: application/json`, and `body: JSON.stringify(...)`.

Current load flow:
```ts
// src/raindrop.tsx lines 103-107
await Promise.all([
  request<CollectionsResponse>("/collections"),
  request<CollectionsResponse>("/collections/childrens"),
]);

// src/raindrop.tsx lines 157-159
request<RaindropsResponse>(
  `/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true`,
);
```
After mutations, existing pattern is `setRefreshToken((current) => current + 1)` (lines 370-373) and both collection/bookmark effects depend on `refreshToken` (lines 146, 190).

Current bookmark ActionPanel:
```tsx
// src/raindrop.tsx lines 356-380
<ActionPanel>
  <Action.OpenInBrowser title="Open Bookmark" url={raindrop.link} />
  <Action.CopyToClipboard title="Copy URL" content={raindrop.link} />
  <Action.CopyToClipboard title="Copy Title" content={raindrop.title || raindrop.link} />
  <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => setRefreshToken((current) => current + 1)} />
  <Action.Push title="Search All Bookmarks" icon={Icon.Globe} target={<RaindropBookmarks initialCollectionId="0" />} />
</ActionPanel>
```
Add requested bookmark actions here, probably grouped with `ActionPanel.Section` for open/copy, edit/move, favorite/delete.

Installed Vicinae capabilities:
```ts
// actions.d.ts lines 37-47
Action.SubmitForm: React.FC<{
  onSubmit: (input: Form.Values) => boolean | void | Promise<boolean | void>;
  title?: string;
  ...
}>;
```
```ts
// form.d.ts lines 2-9, 73-80
<Form actions={...} navigationTitle="...">
  <Form.TextField id="title" defaultValue={...} />
  <Form.Dropdown id="collectionId" filtering isLoading={...}>...</Form.Dropdown>
</Form>
```
But this installed typing exposes `Form.Dropdown` only; it does **not** expose `Form.Dropdown.Item` or `Form.Dropdown.Section` (lines 73-80). This is a risk for “move to collection” forms if following Raycast examples.

Navigation and confirmation:
```ts
// use-navigation.d.ts lines 1-4
const { push, pop } = useNavigation();
```
```ts
// alert.d.ts lines 3-22
confirmAlert({
  title,
  message,
  primaryAction: { title, style: Alert.ActionStyle.Destructive },
}) => Promise<boolean>
```

## Architecture

The repository currently has a single source file, `src/raindrop.tsx`, exporting one view component `RaindropBookmarks`. It owns all state, API access, list rendering, detail markdown, search text, collection dropdown, and action panels.

Data flow:
1. `getPreferenceValues<Preferences>()` reads `apiToken` once in `RaindropBookmarks` (lines 63-67).
2. `request<T>` wraps `fetch` against `https://api.raindrop.io/rest/v1` with bearer auth (lines 78-93).
3. First `useEffect` loads root + child collections and stores them separately (lines 95-146).
4. Second `useEffect` loads bookmarks for `selectedCollectionId` (lines 148-190).
5. Memo helpers flatten/dedupe built-ins + root + child collections into `allCollections` (lines 192-241).
6. UI renders one `List` with a collection search accessory and optional collection suggestion section; bookmark items each get an inline `ActionPanel` (lines 262-385).
7. Refresh is currently a simple state counter used by both effects (lines 76, 146, 190, 370-373).

Likely integration points for requested actions:
- **Copy markdown link:** add another `Action.CopyToClipboard` beside Copy URL/Title. Content should likely be `[${raindrop.title || raindrop.link}](${raindrop.link})`; escaping `]`/`)` is an optional hardening point.
- **Rename bookmark via form:** create a small child component such as `RenameBookmarkForm` in `src/raindrop.tsx`, pushed with `Action.Push`. It can use `Form.TextField` and `Action.SubmitForm`; after successful API mutation, call `pop()` and parent refresh callback. Use `useNavigation` inside the form component.
- **Favorite/unfavorite:** add `important?: boolean` to `Raindrop`; add an action whose title/icon depends on `raindrop.important`. Mutation likely updates raindrop with `{ important: !raindrop.important }`; exact endpoint/payload should be verified against Raindrop API docs.
- **Move to collection:** existing `allCollections` is already available in parent and excludes/labels built-ins/root/nested. A form can use `Form.Dropdown`, but installed typings do not define `Form.Dropdown.Item`; implementation may need to verify runtime support or use an `ActionPanel.Submenu` with `Action` entries for each collection instead of a form dropdown. Payload likely needs `{ collection: { $id: collectionId } }`; exclude built-in `0` (“All Bookmarks”) as a move target, and be careful with `-99` (trash) because delete action should handle trash semantics.
- **Move to trash/delete permanently with confirmation:** import `confirmAlert`/`Alert`; use `Action` with `style={Action.Style.Destructive}` and a destructive primary alert. If `selectedCollectionId === "-99"`, label/action can be “Delete Permanently”; otherwise “Move to Trash”. API semantics are the main open question: repository only currently reads trash as collection `-99`; it has no delete helper. Verify whether moving to trash is a `DELETE /raindrop/{id}` or `PUT /raindrop/{id}` with `collection: { $id: -99 }`, and whether permanent delete is different when already in trash.

## Start Here

Start with `src/raindrop.tsx` around lines 78-93 and 356-380. The first range is where the API helper must be generalized for mutations; the second is the current bookmark ActionPanel where all requested actions should be integrated.

## Supervisor coordination

No blocker requiring supervisor decision. Main implementation risks/open questions:
- Raindrop.io mutation endpoint semantics are not represented in this repo. Verify docs for rename/favorite/move/delete/permanent-delete before coding destructive behavior.
- Installed `@vicinae/api` typings lack `Form.Dropdown.Item`/`Section`; a move form with dropdown options may not type-check unless runtime supports untyped subcomponents or an alternative UI is used.
- `Raindrop` type lacks `important` and collection fields needed for favorites/move state.
- `request` currently returns JSON unconditionally; DELETE/permanent-delete responses may be empty or still JSON. Handle both safely.
- Refreshing collections on every bookmark mutation works via current `refreshToken` but may be unnecessary; still matches existing architecture.
