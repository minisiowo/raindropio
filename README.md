# Raindrop.io for Vicinae

Browse, search, and manage your [Raindrop.io](https://raindrop.io) bookmarks directly from Vicinae.

![Raindrop.io Extension Icon](assets/extension_icon.png)

## Features

- **Collection Navigation:** Browse all bookmarks, unsorted items, trash, or custom collections.
- **Search & Filter:** Search within a selected collection, or type a collection name to immediately search inside it.
- **Detailed Preview:** A clean side pane showing the bookmark's title, excerpt, full link, tags, and creation date.
- **Smart Sorting:** Favorite bookmarks are automatically sorted to the top and decorated with a star.
- **Quick Actions:**
  - `Enter` to open the bookmark in your default browser.
  - Copy bookmark URLs, titles, or pre-formatted Markdown links.
  - Rename bookmarks in-place.
  - Move bookmarks to another collection via a submenu.
  - Toggle favorite/important status.
  - Delete bookmarks (moves to Trash, or deletes permanently if already in Trash, with confirmation prompts).
- **Navigation Stack:** Selecting a collection pushes a new view onto the stack, allowing you to easily pop back to your previous search or collection using the `Escape` key.

## Setup & Configuration

This extension requires a Raindrop.io Access Token to securely fetch and manage your bookmarks. 

### How to get an Access Token:

1. Go to the [Raindrop.io Developer Portal](https://developer.raindrop.io/).
2. Click on **Integration** (or go to [developer.raindrop.io/v1/integrations](https://developer.raindrop.io/v1/integrations)).
3. Register a new integration (e.g., name it "Vicinae Extension").
4. Click on the newly created integration.
5. Under the **Personal Access Token** section, click **Create token**.
6. Copy the generated token.
7. Open the extension preferences in Vicinae, paste the token into the **API Token** field, and save.

## Development

Install dependencies:
```bash
npm install
```

Run in development mode (Vicinae must be running):
```bash
npm run dev
```

Run formatting and code linting:
```bash
npm run format
npm run lint
```

Type-check the codebase:
```bash
npx tsc --noEmit
```

Build the production bundle:
```bash
npm run build
```

## License

This project is licensed under the MIT License.
