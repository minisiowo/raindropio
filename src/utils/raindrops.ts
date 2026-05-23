import type { Raindrop } from "../types";

export function sortFavoriteFirst(raindrops: Raindrop[]) {
	return [...raindrops].sort(
		(left, right) =>
			Number(Boolean(right.important)) - Number(Boolean(left.important)),
	);
}
