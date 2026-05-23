import { ALL_BOOKMARKS_COLLECTION_ID, TRASH_COLLECTION_ID } from "../constants";
import type { Collection, Raindrop } from "../types";

export function normalize(value: string) {
	return value.trim().toLowerCase();
}

export function uniqueCollections(collections: Collection[]) {
	const seen = new Set<number>();

	return collections.filter((collection) => {
		if (seen.has(collection._id)) return false;

		seen.add(collection._id);
		return true;
	});
}

export function uniqueCollectionSuggestions(collections: Collection[]) {
	const seen = new Set<string>();

	return collections.filter((collection) => {
		const key = `${normalize(collection.title)}:${collection.count ?? ""}`;

		if (seen.has(key)) return false;

		seen.add(key);
		return true;
	});
}

export function getCollectionMatchScore(title: string, query: string) {
	const normalizedTitle = normalize(title);
	const titleParts = normalizedTitle.split("/").map((part) => part.trim());
	const lastTitlePart = titleParts[titleParts.length - 1] ?? normalizedTitle;

	if (lastTitlePart.startsWith(query)) return 100;
	if (normalizedTitle.startsWith(query)) return 90;
	if (lastTitlePart.includes(query)) return 70;
	if (normalizedTitle.includes(query)) return 50;

	return 0;
}

export function getCollectionName(collection: Collection) {
	const titleParts = collection.title.split("/");
	return titleParts[titleParts.length - 1]?.trim() || collection.title;
}

export function getCollectionSubtitle(collection: Collection) {
	const count =
		collection.count === undefined
			? undefined
			: formatBookmarkCount(collection.count);
	const path = collection.title.includes("/") ? collection.title : undefined;

	return [path, count].filter(Boolean).join(" · ");
}

export function formatBookmarkCount(count: number) {
	return `${count} ${count === 1 ? "bookmark" : "bookmarks"}`;
}

export function getCollectionTitle(collection: Collection) {
	return collection.count === undefined
		? collection.title
		: `${collection.title} (${collection.count})`;
}

export function isMoveTargetCollection(
	collection: Collection,
	selectedCollectionId: string,
) {
	const collectionId = collection._id.toString();

	return (
		collectionId !== ALL_BOOKMARKS_COLLECTION_ID.toString() &&
		collectionId !== TRASH_COLLECTION_ID.toString() &&
		collectionId !== selectedCollectionId
	);
}

export function getMoveTargetCollections(
	collections: Collection[],
	raindrop: Raindrop,
) {
	return collections.filter(
		(collection) => collection._id !== raindrop.collection?.$id,
	);
}

export function getMutationCollectionId(
	selectedCollectionId: string,
	raindrop: Raindrop,
) {
	if (selectedCollectionId !== ALL_BOOKMARKS_COLLECTION_ID.toString()) {
		return Number(selectedCollectionId);
	}

	if (raindrop.collection?.$id === undefined) {
		throw new Error("Could not determine bookmark collection");
	}

	return raindrop.collection.$id;
}
