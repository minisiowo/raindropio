import { createHash } from "node:crypto";

import { Cache } from "@vicinae/api";

import {
	RAINDROP_CACHE_CAPACITY_BYTES,
	RAINDROP_CACHE_NAMESPACE,
	RAINDROP_CACHE_SCHEMA_VERSION,
} from "../constants";
import type {
	CachedCollections,
	CachedRaindropsIndex,
	CachedRaindropsQuery,
	CacheMetadata,
	Collection,
	Raindrop,
} from "../types";

const CACHE_KEY_PREFIX = `v${RAINDROP_CACHE_SCHEMA_VERSION}`;
const ACCOUNT_KEY_HASH_PREFIX = "raindropio-vicinae-account";
const SEARCH_KEY_HASH_PREFIX = "raindropio-vicinae-search";

const raindropCache = new Cache({
	namespace: RAINDROP_CACHE_NAMESPACE,
	capacity: RAINDROP_CACHE_CAPACITY_BYTES,
});
const cacheInvalidationSubscribers = new Set<() => void>();

type CacheKey = string;
type RaindropPatch = Partial<Raindrop> | ((raindrop: Raindrop) => Raindrop);

export function getRaindropAccountKey(apiToken: string) {
	return hashValue(ACCOUNT_KEY_HASH_PREFIX, apiToken);
}

export function readCollections(accountKey: string) {
	return readCachedValue<CachedCollections>(
		getCollectionsKey(accountKey),
		accountKey,
		isCachedCollections,
	);
}

export function writeCollections(
	accountKey: string,
	collections: Pick<CachedCollections, "rootCollections" | "childCollections">,
) {
	const cachedCollections: CachedCollections = {
		version: RAINDROP_CACHE_SCHEMA_VERSION,
		accountKey,
		updatedAt: new Date().toISOString(),
		rootCollections: collections.rootCollections,
		childCollections: collections.childCollections,
	};

	writeCachedValue(getCollectionsKey(accountKey), cachedCollections);
}

export function readQuery(
	accountKey: string,
	collectionId: string,
	search = "",
) {
	return readCachedValue<CachedRaindropsQuery>(
		getQueryKey(accountKey, collectionId, search),
		accountKey,
		isCachedRaindropsQuery,
	);
}

export function writeQuery(
	accountKey: string,
	entry: Omit<CachedRaindropsQuery, "version" | "accountKey" | "updatedAt">,
) {
	const cachedQuery: CachedRaindropsQuery = {
		...entry,
		version: RAINDROP_CACHE_SCHEMA_VERSION,
		accountKey,
		updatedAt: new Date().toISOString(),
		search: normalizeSearch(entry.search),
	};

	const key = getQueryKey(
		accountKey,
		cachedQuery.collectionId,
		cachedQuery.search,
	);
	writeCachedValue(key, cachedQuery);
	addKnownQueryKey(accountKey, key);
}

export function removeQuery(
	accountKey: string,
	collectionId: string,
	search = "",
) {
	const key = getQueryKey(accountKey, collectionId, search);
	raindropCache.remove(key);
	removeKnownQueryKey(accountKey, key);
	notifyCacheInvalidationSubscribers();
}

export function readAllIndex(accountKey: string) {
	return readCachedValue<CachedRaindropsIndex>(
		getAllIndexKey(accountKey),
		accountKey,
		isCachedRaindropsIndex,
	);
}

export function writeAllIndex(
	accountKey: string,
	index: Omit<CachedRaindropsIndex, "version" | "accountKey" | "updatedAt">,
) {
	const cachedIndex: CachedRaindropsIndex = {
		...index,
		version: RAINDROP_CACHE_SCHEMA_VERSION,
		accountKey,
		updatedAt: new Date().toISOString(),
	};

	writeCachedValue(getAllIndexKey(accountKey), cachedIndex);
}

export function removeAllIndex(accountKey: string) {
	raindropCache.remove(getAllIndexKey(accountKey));
	notifyCacheInvalidationSubscribers();
}

export function patchCachedRaindrop(
	accountKey: string,
	raindropId: number,
	patch: RaindropPatch,
) {
	patchAllIndexRaindrop(accountKey, raindropId, patch);

	for (const queryKey of readMetadata(accountKey)?.queryKeys ?? []) {
		patchQueryRaindrop(accountKey, queryKey, raindropId, patch);
	}
}

export function removeCachedRaindrop(accountKey: string, raindropId: number) {
	const allIndex = readAllIndex(accountKey);
	if (allIndex) {
		const nextItems = allIndex.items.filter(
			(raindrop) => raindrop._id !== raindropId,
		);
		if (nextItems.length !== allIndex.items.length) {
			writeAllIndex(accountKey, {
				items: nextItems,
				count: Math.max(
					0,
					allIndex.count - (allIndex.items.length - nextItems.length),
				),
				isComplete: allIndex.isComplete,
				nextPage: allIndex.nextPage,
			});
		}
	}

	for (const queryKey of readMetadata(accountKey)?.queryKeys ?? []) {
		const query = readCachedValue<CachedRaindropsQuery>(
			queryKey,
			accountKey,
			isCachedRaindropsQuery,
		);
		if (!query) {
			removeKnownQueryKey(accountKey, queryKey);
			continue;
		}

		const nextItems = query.items.filter(
			(raindrop) => raindrop._id !== raindropId,
		);
		if (nextItems.length !== query.items.length) {
			writeCachedValue(queryKey, {
				...query,
				updatedAt: new Date().toISOString(),
				items: nextItems,
				count: Math.max(
					0,
					query.count - (query.items.length - nextItems.length),
				),
			});
		}
	}
}

export function clearCachedQueries(accountKey: string) {
	const metadata = readMetadata(accountKey);
	for (const queryKey of metadata?.queryKeys ?? []) {
		raindropCache.remove(queryKey);
	}

	writeMetadata(accountKey, {
		lastSuccessfulSyncAt: metadata?.lastSuccessfulSyncAt,
		queryKeys: [],
	});
	notifyCacheInvalidationSubscribers();
}

export function clearAccountCache(accountKey: string) {
	for (const queryKey of readMetadata(accountKey)?.queryKeys ?? []) {
		raindropCache.remove(queryKey);
	}

	raindropCache.remove(getCollectionsKey(accountKey));
	raindropCache.remove(getAllIndexKey(accountKey));
	raindropCache.remove(getMetadataKey(accountKey));
	notifyCacheInvalidationSubscribers();
}

export function subscribeCacheInvalidation(subscriber: () => void) {
	cacheInvalidationSubscribers.add(subscriber);

	return () => {
		cacheInvalidationSubscribers.delete(subscriber);
	};
}

export function getRaindropsQueryCacheKey(
	accountKey: string,
	collectionId: string,
	search = "",
) {
	return getQueryKey(accountKey, collectionId, search);
}

function patchAllIndexRaindrop(
	accountKey: string,
	raindropId: number,
	patch: RaindropPatch,
) {
	const allIndex = readAllIndex(accountKey);
	if (!allIndex) {
		return;
	}

	const nextItems = patchRaindropItems(allIndex.items, raindropId, patch);
	if (nextItems !== allIndex.items) {
		writeAllIndex(accountKey, {
			items: nextItems,
			count: allIndex.count,
			isComplete: allIndex.isComplete,
			nextPage: allIndex.nextPage,
		});
	}
}

function patchQueryRaindrop(
	accountKey: string,
	queryKey: CacheKey,
	raindropId: number,
	patch: RaindropPatch,
) {
	const query = readCachedValue<CachedRaindropsQuery>(
		queryKey,
		accountKey,
		isCachedRaindropsQuery,
	);
	if (!query) {
		removeKnownQueryKey(accountKey, queryKey);
		return;
	}

	const nextItems = patchRaindropItems(query.items, raindropId, patch);
	if (nextItems !== query.items) {
		writeCachedValue(queryKey, {
			...query,
			updatedAt: new Date().toISOString(),
			items: nextItems,
		});
	}
}

function patchRaindropItems(
	items: Raindrop[],
	raindropId: number,
	patch: RaindropPatch,
) {
	let changed = false;
	const nextItems = items.map((raindrop) => {
		if (raindrop._id !== raindropId) {
			return raindrop;
		}

		changed = true;
		return typeof patch === "function"
			? patch(raindrop)
			: { ...raindrop, ...patch };
	});

	return changed ? nextItems : items;
}

function readMetadata(accountKey: string) {
	return readCachedValue<CacheMetadata>(
		getMetadataKey(accountKey),
		accountKey,
		isCacheMetadata,
	);
}

function writeMetadata(
	accountKey: string,
	metadata: Pick<CacheMetadata, "queryKeys" | "lastSuccessfulSyncAt">,
) {
	writeCachedValue(getMetadataKey(accountKey), {
		version: RAINDROP_CACHE_SCHEMA_VERSION,
		accountKey,
		updatedAt: new Date().toISOString(),
		lastSuccessfulSyncAt: metadata.lastSuccessfulSyncAt,
		queryKeys: Array.from(new Set(metadata.queryKeys)),
	});
}

function addKnownQueryKey(accountKey: string, queryKey: CacheKey) {
	const metadata = readMetadata(accountKey);
	writeMetadata(accountKey, {
		lastSuccessfulSyncAt: metadata?.lastSuccessfulSyncAt,
		queryKeys: [...(metadata?.queryKeys ?? []), queryKey],
	});
}

function removeKnownQueryKey(accountKey: string, queryKey: CacheKey) {
	const metadata = readMetadata(accountKey);
	if (!metadata) {
		return;
	}

	writeMetadata(accountKey, {
		lastSuccessfulSyncAt: metadata.lastSuccessfulSyncAt,
		queryKeys: metadata.queryKeys.filter(
			(knownQueryKey) => knownQueryKey !== queryKey,
		),
	});
}

function readCachedValue<T>(
	key: CacheKey,
	accountKey: string,
	isValue: (value: unknown, accountKey: string) => value is T,
) {
	const value = safeParseJson(raindropCache.get(key));
	if (!isValue(value, accountKey)) {
		return undefined;
	}

	return value;
}

function writeCachedValue(key: CacheKey, value: unknown) {
	raindropCache.set(key, JSON.stringify(value));
}

function notifyCacheInvalidationSubscribers() {
	for (const subscriber of cacheInvalidationSubscribers) {
		subscriber();
	}
}

function safeParseJson(value: string | undefined) {
	if (value === undefined) {
		return undefined;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}

function getCollectionsKey(accountKey: string) {
	return `${CACHE_KEY_PREFIX}:${accountKey}:collections`;
}

function getQueryKey(accountKey: string, collectionId: string, search: string) {
	return `${CACHE_KEY_PREFIX}:${accountKey}:query:${encodeURIComponent(collectionId)}:${getSearchKey(search)}`;
}

function getAllIndexKey(accountKey: string) {
	return `${CACHE_KEY_PREFIX}:${accountKey}:index:all`;
}

function getMetadataKey(accountKey: string) {
	return `${CACHE_KEY_PREFIX}:${accountKey}:metadata`;
}

function getSearchKey(search: string) {
	return hashValue(SEARCH_KEY_HASH_PREFIX, normalizeSearch(search));
}

function normalizeSearch(search: string) {
	return search.trim().toLowerCase();
}

function hashValue(prefix: string, value: string) {
	return createHash("sha256")
		.update(prefix)
		.update("\0")
		.update(value)
		.digest("hex");
}

function hasCacheEnvelope(
	value: unknown,
	accountKey: string,
): value is Record<string, unknown> & {
	version: number;
	accountKey: string;
	updatedAt: string;
} {
	return (
		isRecord(value) &&
		value.version === RAINDROP_CACHE_SCHEMA_VERSION &&
		value.accountKey === accountKey &&
		typeof value.updatedAt === "string"
	);
}

function isCacheMetadata(
	value: unknown,
	accountKey: string,
): value is CacheMetadata {
	return hasCacheEnvelope(value, accountKey) && isStringArray(value.queryKeys);
}

function isCachedCollections(
	value: unknown,
	accountKey: string,
): value is CachedCollections {
	return (
		hasCacheEnvelope(value, accountKey) &&
		Array.isArray(value.rootCollections) &&
		value.rootCollections.every(isCollection) &&
		Array.isArray(value.childCollections) &&
		value.childCollections.every(isCollection)
	);
}

function isCachedRaindropsQuery(
	value: unknown,
	accountKey: string,
): value is CachedRaindropsQuery {
	return (
		hasCacheEnvelope(value, accountKey) &&
		typeof value.collectionId === "string" &&
		typeof value.search === "string" &&
		Array.isArray(value.items) &&
		value.items.every(isRaindrop) &&
		typeof value.count === "number" &&
		typeof value.nextPage === "number" &&
		Array.isArray(value.loadedPages) &&
		value.loadedPages.every((page) => typeof page === "number") &&
		typeof value.isComplete === "boolean" &&
		(value.source === "query" || value.source === "full-index")
	);
}

function isCachedRaindropsIndex(
	value: unknown,
	accountKey: string,
): value is CachedRaindropsIndex {
	return (
		hasCacheEnvelope(value, accountKey) &&
		Array.isArray(value.items) &&
		value.items.every(isRaindrop) &&
		typeof value.count === "number" &&
		typeof value.isComplete === "boolean" &&
		typeof value.nextPage === "number"
	);
}

function isRaindrop(value: unknown): value is Raindrop {
	return (
		isRecord(value) &&
		typeof value._id === "number" &&
		typeof value.title === "string" &&
		typeof value.link === "string"
	);
}

function isCollection(value: unknown): value is Collection {
	return (
		isRecord(value) &&
		typeof value._id === "number" &&
		typeof value.title === "string"
	);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
