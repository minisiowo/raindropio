# Agent Guide: src

## Source layout

- `raindrop.tsx` is the Vicinae command entrypoint. Keep it as a default export for the `raindrop` command; put implementation details in components/utilities.
- `components/` contains React/Vicinae UI and action composition. `RaindropBookmarks.tsx` is the stateful container for loading, mutation callbacks, and top-level list composition.
- `api/` contains Raindrop.io transport helpers. Keep this layer UI-free: no Vicinae toasts, navigation, or components.
- `utils/` contains pure helpers. Keep these free of React/Vicinae side effects.
- `types.ts` and `constants.ts` hold shared contracts and API constants.

## Behavior invariants

- Built-in collection IDs are API-significant: All Bookmarks `0`, Unsorted `-1`, Trash `-99`.
- Mutations from All Bookmarks must use the bookmark's concrete `collection.$id`; do not silently fall back to collection `0`.
- Move targets should exclude All Bookmarks, Trash, the selected collection, and the bookmark's current collection when known.
- Keep destructive actions confirmation-gated. Permanent delete should only be offered while viewing Trash.
- Preserve `Action.Push` collection navigation so Escape can pop back to the previous view.
- Favorite bookmarks should sort first and show the star as a right-side accessory, not as the main item icon.

## Privacy and API safety

- Never log, toast, or commit the Raindrop API token.
- Treat bookmark titles, URLs, excerpts, tags, and collection names as private user data.
- Keep `Authorization: Bearer <token>` injection centralized in the API helper.
