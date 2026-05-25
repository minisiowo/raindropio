import type { Collection, Raindrop } from "../types";
import { normalize } from "./collections";
import { sortFavoriteFirst } from "./raindrops";

type ScoredRaindrop = {
	raindrop: Raindrop;
	score: number;
	index: number;
};

export function getRaindropSearchText(
	raindrop: Raindrop,
	collectionTitle?: string,
) {
	return [
		raindrop.title,
		raindrop.link,
		raindrop.domain,
		raindrop.excerpt,
		...(raindrop.tags ?? []),
		collectionTitle,
	]
		.filter(Boolean)
		.join(" ");
}

export function getRaindropMatchScore(
	raindrop: Raindrop,
	query: string,
	collectionTitle?: string,
) {
	const normalizedQuery = normalize(query);
	if (!normalizedQuery) return 0;

	const title = normalize(raindrop.title);
	const link = normalize(raindrop.link);
	const domain = normalize(raindrop.domain ?? "");
	const excerpt = normalize(raindrop.excerpt ?? "");
	const collection = normalize(collectionTitle ?? "");
	const tags = (raindrop.tags ?? []).map(normalize);
	const searchableText = normalize(
		getRaindropSearchText(raindrop, collectionTitle),
	);
	const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
	const allPartsMatch = queryParts.every((part) =>
		searchableText.includes(part),
	);

	if (!allPartsMatch) return 0;

	let score = queryParts.length > 1 ? 10 : 0;

	if (title === normalizedQuery) score += 1000;
	else if (title.startsWith(normalizedQuery)) score += 900;
	else if (title.includes(normalizedQuery)) score += 700;

	if (domain === normalizedQuery) score += 650;
	else if (domain.startsWith(normalizedQuery)) score += 600;
	else if (domain.includes(normalizedQuery)) score += 500;

	if (link.includes(normalizedQuery)) score += 450;

	if (tags.some((tag) => tag === normalizedQuery)) score += 420;
	else if (tags.some((tag) => tag.startsWith(normalizedQuery))) score += 360;
	else if (tags.some((tag) => tag.includes(normalizedQuery))) score += 300;

	if (excerpt.includes(normalizedQuery)) score += 180;
	if (collection.includes(normalizedQuery)) score += 120;

	for (const part of queryParts) {
		if (part === normalizedQuery) continue;
		if (title.startsWith(part)) score += 80;
		else if (title.includes(part)) score += 60;
		if (domain.includes(part) || link.includes(part)) score += 40;
		if (tags.some((tag) => tag.includes(part))) score += 30;
		if (excerpt.includes(part) || collection.includes(part)) score += 10;
	}

	return score || 1;
}

export function searchRaindropsLocally(
	raindrops: Raindrop[],
	query: string,
	collections: Collection[] = [],
) {
	const normalizedQuery = normalize(query);
	if (!normalizedQuery) return sortFavoriteFirst(raindrops);

	const collectionTitles = new Map(
		collections.map((collection) => [collection._id, collection.title]),
	);

	const scoredRaindrops: ScoredRaindrop[] = raindrops
		.map((raindrop, index) => ({
			raindrop,
			score: getRaindropMatchScore(
				raindrop,
				normalizedQuery,
				raindrop.collection?.$id === undefined
					? undefined
					: collectionTitles.get(raindrop.collection.$id),
			),
			index,
		}))
		.filter(({ score }) => score > 0)
		.sort(
			(left, right) => right.score - left.score || left.index - right.index,
		);

	return sortFavoriteFirst(scoredRaindrops.map(({ raindrop }) => raindrop));
}
