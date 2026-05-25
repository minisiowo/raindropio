import {
	fetchChildCollections,
	fetchRaindrops,
	fetchRootCollections,
	type RaindropRequest,
} from "../api/raindrop-api";
import { ALL_BOOKMARKS_COLLECTION_ID, RAINDROPS_PER_PAGE } from "../constants";
import type { Collection, Raindrop, RaindropsResponse } from "../types";
import { mergeRaindropsById } from "../utils/raindrops";

export type SyncedCollections = {
	rootCollections: Collection[];
	childCollections: Collection[];
};

export type RaindropSyncPage = {
	items: Raindrop[];
	count: number;
	page: number;
	nextPage: number;
	loadedPages: number[];
	isComplete: boolean;
};

export type FetchRaindropQueryPageOptions = {
	collectionId: string;
	search?: string;
	page?: number;
	perPage?: number;
};

export type FetchNextRaindropQueryPageOptions = Omit<
	FetchRaindropQueryPageOptions,
	"page"
>;

export type SyncAllBookmarksIndexOptions = {
	perPage?: number;
	maxPages?: number;
	onPage?: (page: RaindropSyncPage) => void | Promise<void>;
};

const DEFAULT_MAX_SYNC_PAGES = 10000;

export async function fetchCollections(
	request: RaindropRequest,
): Promise<SyncedCollections> {
	const [rootCollectionsResponse, childCollectionsResponse] = await Promise.all(
		[fetchRootCollections(request), fetchChildCollections(request)],
	);

	if (!rootCollectionsResponse.result) {
		throw new Error(
			rootCollectionsResponse.errorMessage ?? "Could not load root collections",
		);
	}

	if (!childCollectionsResponse.result) {
		throw new Error(
			childCollectionsResponse.errorMessage ??
				"Could not load child collections",
		);
	}

	return {
		rootCollections: rootCollectionsResponse.items ?? [],
		childCollections: childCollectionsResponse.items ?? [],
	};
}

export async function fetchFirstRaindropQueryPage(
	request: RaindropRequest,
	options: FetchNextRaindropQueryPageOptions,
) {
	return fetchRaindropQueryPage(request, { ...options, page: 0 });
}

export async function fetchNextRaindropQueryPage(
	request: RaindropRequest,
	currentPage: RaindropSyncPage,
	options: FetchNextRaindropQueryPageOptions,
) {
	const incomingPage = await fetchRaindropQueryPage(request, {
		...options,
		page: currentPage.nextPage,
	});
	const mergedItems = mergeRaindropsById(currentPage.items, incomingPage.items);
	const hasNewItems = mergedItems.length > currentPage.items.length;
	const loadedPages = Array.from(
		new Set([...currentPage.loadedPages, incomingPage.page]),
	);
	const isComplete =
		incomingPage.items.length === 0 ||
		!hasNewItems ||
		mergedItems.length >= incomingPage.count;

	return {
		items: mergedItems,
		count: incomingPage.count,
		page: incomingPage.page,
		nextPage: incomingPage.nextPage,
		loadedPages,
		isComplete,
	};
}

export async function syncAllBookmarksIndex(
	request: RaindropRequest,
	options: SyncAllBookmarksIndexOptions = {},
) {
	const perPage = options.perPage ?? RAINDROPS_PER_PAGE;
	const maxPages = options.maxPages ?? DEFAULT_MAX_SYNC_PAGES;
	let syncedPage = await fetchFirstRaindropQueryPage(request, {
		collectionId: ALL_BOOKMARKS_COLLECTION_ID.toString(),
		perPage,
	});
	await options.onPage?.(syncedPage);

	while (!syncedPage.isComplete && syncedPage.loadedPages.length < maxPages) {
		const nextPage = await fetchNextRaindropQueryPage(request, syncedPage, {
			collectionId: ALL_BOOKMARKS_COLLECTION_ID.toString(),
			perPage,
		});

		syncedPage = {
			...nextPage,
			isComplete:
				nextPage.isComplete || nextPage.loadedPages.length >= maxPages,
		};
		await options.onPage?.(syncedPage);
	}

	return syncedPage;
}

export async function fetchRaindropQueryPage(
	request: RaindropRequest,
	{
		collectionId,
		page = 0,
		perPage = RAINDROPS_PER_PAGE,
		search,
	}: FetchRaindropQueryPageOptions,
) {
	const data = await fetchRaindrops(request, {
		collectionId,
		page,
		perPage,
		search,
	});

	ensureRaindropsResult(data);

	const items = data.items ?? [];
	const count = data.count ?? items.length;

	return {
		items,
		count,
		page,
		nextPage: page + 1,
		loadedPages: [page],
		isComplete: items.length === 0 || items.length >= count,
	};
}

function ensureRaindropsResult(data: RaindropsResponse) {
	if (!data.result) {
		throw new Error(data.errorMessage ?? "Raindrop.io API request failed");
	}
}
