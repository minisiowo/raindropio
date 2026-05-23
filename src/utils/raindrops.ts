import type { Raindrop } from "../types";

export function sortFavoriteFirst(raindrops: Raindrop[]) {
	return [...raindrops].sort(
		(left, right) =>
			Number(Boolean(right.important)) - Number(Boolean(left.important)),
	);
}

export function mergeRaindropsById(existing: Raindrop[], incoming: Raindrop[]) {
	const raindropsById = new Map<number, Raindrop>();

	for (const raindrop of existing) {
		raindropsById.set(raindrop._id, raindrop);
	}

	for (const raindrop of incoming) {
		raindropsById.set(raindrop._id, raindrop);
	}

	return Array.from(raindropsById.values());
}
