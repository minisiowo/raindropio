export type SearchSuggestionMode =
	| { kind: "tags"; query: string }
	| { kind: "collections"; query: string }
	| { kind: "bookmarks"; query: string };

export function getSearchSuggestionMode(
	searchText: string,
): SearchSuggestionMode {
	const trimmedStart = searchText.trimStart();

	if (trimmedStart.startsWith("#")) {
		return { kind: "tags", query: trimmedStart.slice(1).trim() };
	}

	if (trimmedStart.startsWith("/")) {
		return { kind: "collections", query: trimmedStart.slice(1).trim() };
	}

	return { kind: "bookmarks", query: searchText };
}
