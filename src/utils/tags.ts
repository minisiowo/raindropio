import type { Raindrop } from "../types";
import { normalize } from "./collections";

export type TagSuggestion = {
	tag: string;
	count: number;
};

export function getTagSuggestionsFromRaindrops(
	raindrops: Raindrop[],
): TagSuggestion[] {
	const suggestions = new Map<string, TagSuggestion>();

	for (const raindrop of raindrops) {
		const seenTagsForRaindrop = new Set<string>();

		for (const rawTag of raindrop.tags ?? []) {
			const tag = rawTag.trim();
			const normalizedTag = normalize(tag);

			if (!normalizedTag || seenTagsForRaindrop.has(normalizedTag)) continue;

			seenTagsForRaindrop.add(normalizedTag);
			const suggestion = suggestions.get(normalizedTag);

			if (suggestion) {
				suggestion.count += 1;
			} else {
				suggestions.set(normalizedTag, { tag, count: 1 });
			}
		}
	}

	return Array.from(suggestions.values()).sort(
		(left, right) =>
			right.count - left.count || left.tag.localeCompare(right.tag),
	);
}

export function getTagMatchScore(tag: string, query: string) {
	const normalizedTag = normalize(tag);
	const normalizedQuery = normalize(query);

	if (!normalizedQuery) return 0;
	if (normalizedTag === normalizedQuery) return 100;
	if (normalizedTag.startsWith(normalizedQuery)) return 90;
	if (normalizedTag.includes(normalizedQuery)) return 50;

	return 0;
}

export function uniqueTagSuggestions(tags: TagSuggestion[]) {
	const seen = new Set<string>();

	return tags.filter((suggestion) => {
		const key = normalize(suggestion.tag);

		if (!key || seen.has(key)) return false;

		seen.add(key);
		return true;
	});
}

export function raindropHasTag(raindrop: Raindrop, tag: string) {
	const normalizedTag = normalize(tag);

	if (!normalizedTag) return true;

	return (raindrop.tags ?? []).some(
		(raindropTag) => normalize(raindropTag) === normalizedTag,
	);
}

export function filterRaindropsByTag(raindrops: Raindrop[], tag?: string) {
	if (!tag || !normalize(tag)) return raindrops;

	return raindrops.filter((raindrop) => raindropHasTag(raindrop, tag));
}
