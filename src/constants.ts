import type { Collection } from "./types";

export const ALL_BOOKMARKS_COLLECTION_ID = 0;
export const UNSORTED_COLLECTION_ID = -1;
export const TRASH_COLLECTION_ID = -99;
export const MAX_COLLECTION_SUGGESTIONS = 6;
export const RAINDROPS_PER_PAGE = 50;
export const SERVER_SEARCH_DEBOUNCE_MS = 300;
export const RAINDROP_API_BASE_URL = "https://api.raindrop.io/rest/v1";

export const BUILT_IN_COLLECTIONS: Collection[] = [
	{ _id: ALL_BOOKMARKS_COLLECTION_ID, title: "All Bookmarks" },
	{ _id: UNSORTED_COLLECTION_ID, title: "Unsorted" },
	{ _id: TRASH_COLLECTION_ID, title: "Trash" },
];
