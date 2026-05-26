import {
	Alert,
	confirmAlert,
	getPreferenceValues,
	Icon,
	List,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	createRaindropRequest,
	ensureMutationResult,
	fetchRaindrops,
	jsonRequestInit,
} from "../api/raindrop-api";
import {
	clearCachedQueries,
	getRaindropAccountKey,
	patchCachedRaindrop,
	readAllIndex,
	readCollections,
	readQuery,
	removeCachedRaindrop,
	writeAllIndex,
	writeCollections,
	writeQuery,
} from "../cache/raindrop-cache";
import {
	ALL_BOOKMARKS_COLLECTION_ID,
	BUILT_IN_COLLECTIONS,
	MAX_COLLECTION_SUGGESTIONS,
	RAINDROPS_PER_PAGE,
	SERVER_SEARCH_DEBOUNCE_MS,
	TRASH_COLLECTION_ID,
} from "../constants";
import {
	fetchCollections,
	fetchFirstRaindropQueryPage,
	syncAllBookmarksIndex,
} from "../sync/raindrop-sync";
import type {
	Collection,
	MutationResponse,
	Preferences,
	Raindrop,
	RaindropBookmarksProps,
	RaindropsQueryCacheEntry,
} from "../types";
import {
	getCollectionMatchScore,
	getCollectionName,
	getMutationCollectionId,
	isMoveTargetCollection,
	normalize,
	uniqueCollectionSuggestions,
	uniqueCollections,
} from "../utils/collections";
import { getErrorMessage } from "../utils/errors";
import { mergeRaindropsById, sortFavoriteFirst } from "../utils/raindrops";
import { searchRaindropsLocally } from "../utils/search";
import { BookmarkListSection } from "./BookmarkListSection";
import { CollectionDropdown } from "./CollectionDropdown";
import { CollectionSuggestionsSection } from "./CollectionSuggestionsSection";

const raindropsQueryCache = new Map<string, RaindropsQueryCacheEntry>();
let raindropsQueryCacheToken: string | undefined;

function getRaindropsQueryKey(collectionId: string, search: string) {
	return `${collectionId}:${normalize(search)}`;
}

function getLocalRaindropsForQuery(
	raindrops: Raindrop[],
	collectionId: string,
	search: string,
	collections: Collection[],
) {
	if (collectionId === TRASH_COLLECTION_ID.toString()) return undefined;

	const collectionIds = getLocalCollectionIds(collectionId, collections);
	const collectionRaindrops =
		collectionId === ALL_BOOKMARKS_COLLECTION_ID.toString()
			? raindrops
			: raindrops.filter(
					(raindrop) =>
						raindrop.collection?.$id !== undefined &&
						collectionIds.has(raindrop.collection.$id.toString()),
				);

	return searchRaindropsLocally(collectionRaindrops, search, collections);
}

function getLocalCollectionIds(
	collectionId: string,
	collections: Collection[],
) {
	const collectionIds = new Set([collectionId]);
	let addedCollection = true;

	while (addedCollection) {
		addedCollection = false;

		for (const collection of collections) {
			const parentId = collection.parent?.$id?.toString();
			const childId = collection._id.toString();

			if (
				parentId &&
				collectionIds.has(parentId) &&
				!collectionIds.has(childId)
			) {
				collectionIds.add(childId);
				addedCollection = true;
			}
		}
	}

	return collectionIds;
}

export default function RaindropBookmarks({
	initialCollectionId = ALL_BOOKMARKS_COLLECTION_ID.toString(),
}: RaindropBookmarksProps = {}) {
	const { apiToken } = getPreferenceValues<Preferences>();
	const accountKey = useMemo(() => getRaindropAccountKey(apiToken), [apiToken]);
	const { push } = useNavigation();
	const [raindrops, setRaindrops] = useState<Raindrop[]>([]);
	const [raindropsCount, setRaindropsCount] = useState(0);
	const [nextPage, setNextPage] = useState(0);
	const [rootCollections, setRootCollections] = useState<Collection[]>([]);
	const [childCollections, setChildCollections] = useState<Collection[]>([]);
	const [selectedCollectionId] = useState(initialCollectionId);
	const [searchText, setSearchText] = useState("");
	const [debouncedSearchText, setDebouncedSearchText] = useState("");
	const [isLoadingRaindrops, setIsLoadingRaindrops] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isLoadingCollections, setIsLoadingCollections] = useState(true);
	const [error, setError] = useState<string>();
	const [loadMoreError, setLoadMoreError] = useState<string>();
	const [refreshToken, setRefreshToken] = useState(0);
	const requestIdRef = useRef(0);
	const activeQueryKeyRef = useRef("");

	useEffect(() => {
		if (raindropsQueryCacheToken === accountKey) return;

		raindropsQueryCache.clear();
		raindropsQueryCacheToken = accountKey;
	}, [accountKey]);

	const request = useMemo(() => createRaindropRequest(apiToken), [apiToken]);
	const activeQueryKey = useMemo(
		() => getRaindropsQueryKey(selectedCollectionId, debouncedSearchText),
		[selectedCollectionId, debouncedSearchText],
	);

	useEffect(() => {
		let isCancelled = false;
		const cachedAllIndex = readAllIndex(accountKey);

		if (cachedAllIndex?.isComplete) return;

		void syncAllBookmarksIndex(request, {
			onPage: (page) => {
				if (isCancelled) return;
				writeAllIndex(accountKey, {
					items: sortFavoriteFirst(page.items),
					count: page.count,
					isComplete: page.isComplete,
					nextPage: page.nextPage,
				});
			},
		}).catch(() => {
			// Keep startup local-first and do not discard existing cached data on sync failure.
		});

		return () => {
			isCancelled = true;
		};
	}, [accountKey, request]);

	const invalidateRaindropsQueryCache = useCallback(() => {
		raindropsQueryCache.clear();
		requestIdRef.current += 1;
		setIsLoadingMore(false);
	}, []);

	const refresh = useCallback(() => {
		invalidateRaindropsQueryCache();
		setRefreshToken((current) => current + 1);
	}, [invalidateRaindropsQueryCache]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setDebouncedSearchText(searchText.trim());
		}, SERVER_SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timeout);
	}, [searchText]);

	useEffect(() => {
		void refreshToken;
		let isMounted = true;

		async function loadCollections() {
			const cachedCollections = readCollections(accountKey);
			if (cachedCollections) {
				setRootCollections(cachedCollections.rootCollections);
				setChildCollections(cachedCollections.childCollections);
				setIsLoadingCollections(false);
			} else {
				setIsLoadingCollections(true);
			}

			try {
				const collections = await fetchCollections(request);

				if (!isMounted) return;
				writeCollections(accountKey, collections);
				setRootCollections(collections.rootCollections);
				setChildCollections(collections.childCollections);
			} catch (error) {
				const message = getErrorMessage(error, "Failed to load collections");

				if (!isMounted) return;
				showToast(
					Toast.Style.Failure,
					"Failed to load Raindrop.io collections",
					message,
				);
			} finally {
				if (isMounted) setIsLoadingCollections(false);
			}
		}

		loadCollections();

		return () => {
			isMounted = false;
		};
	}, [accountKey, request, refreshToken]);

	useEffect(() => {
		void refreshToken;
		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		activeQueryKeyRef.current = activeQueryKey;
		setIsLoadingMore(false);
		setLoadMoreError(undefined);
		const queryCollections = [
			...BUILT_IN_COLLECTIONS,
			...rootCollections,
			...childCollections,
		];

		const cachedQuery = raindropsQueryCache.get(activeQueryKey);
		let hasHydratedRaindrops = false;
		if (cachedQuery) {
			setRaindrops(cachedQuery.items);
			setRaindropsCount(cachedQuery.count);
			setNextPage(cachedQuery.nextPage);
			setError(undefined);
			setIsLoadingMore(false);
			setIsLoadingRaindrops(false);
			hasHydratedRaindrops = true;
		} else {
			const persistedQuery = readQuery(
				accountKey,
				selectedCollectionId,
				debouncedSearchText,
			);
			if (persistedQuery) {
				raindropsQueryCache.set(activeQueryKey, {
					items: persistedQuery.items,
					count: persistedQuery.count,
					nextPage: persistedQuery.nextPage,
				});
				setRaindrops(persistedQuery.items);
				setRaindropsCount(persistedQuery.count);
				setNextPage(persistedQuery.nextPage);
				setError(undefined);
				setIsLoadingRaindrops(false);
				hasHydratedRaindrops = true;
			} else {
				const allIndex = readAllIndex(accountKey);
				if (allIndex?.isComplete) {
					const items = getLocalRaindropsForQuery(
						allIndex.items,
						selectedCollectionId,
						debouncedSearchText,
						queryCollections,
					);
					if (items) {
						const nextPage = 0;
						raindropsQueryCache.set(activeQueryKey, {
							items,
							count: items.length,
							nextPage,
						});
						setRaindrops(items);
						setRaindropsCount(items.length);
						setNextPage(nextPage);
						setError(undefined);
						setIsLoadingRaindrops(false);
						hasHydratedRaindrops = true;
					}
				}
			}
		}

		let isMounted = true;

		async function loadRaindrops() {
			setIsLoadingRaindrops(!hasHydratedRaindrops);
			setError(undefined);
			if (!hasHydratedRaindrops) {
				setRaindrops([]);
				setRaindropsCount(0);
				setNextPage(0);
			}

			try {
				const data = await fetchFirstRaindropQueryPage(request, {
					collectionId: selectedCollectionId,
					perPage: RAINDROPS_PER_PAGE,
					search: debouncedSearchText,
				});

				if (!isMounted || requestId !== requestIdRef.current) return;

				const items = sortFavoriteFirst(data.items);
				const count = data.count;
				const nextPage = data.nextPage;
				raindropsQueryCache.set(activeQueryKey, {
					items,
					count,
					nextPage,
				});
				writeQuery(accountKey, {
					collectionId: selectedCollectionId,
					search: debouncedSearchText,
					items,
					count,
					nextPage,
					loadedPages: data.loadedPages,
					isComplete: data.isComplete,
					source: "query",
				});
				setRaindrops(items);
				setRaindropsCount(count);
				setNextPage(nextPage);
			} catch (error) {
				const message = getErrorMessage(error, "Failed to load bookmarks");

				if (!isMounted || requestId !== requestIdRef.current) return;
				if (!hasHydratedRaindrops) {
					setError(message);
				}
				showToast(
					Toast.Style.Failure,
					hasHydratedRaindrops
						? "Could not sync Raindrop.io bookmarks"
						: "Failed to load Raindrop.io bookmarks",
					message,
				);
			} finally {
				if (isMounted && requestId === requestIdRef.current) {
					setIsLoadingRaindrops(false);
				}
			}
		}

		loadRaindrops();

		return () => {
			isMounted = false;
		};
	}, [
		accountKey,
		activeQueryKey,
		childCollections,
		debouncedSearchText,
		request,
		rootCollections,
		selectedCollectionId,
		refreshToken,
	]);

	const childCollectionTitles = useMemo(() => {
		const titles = new Map(
			rootCollections.map((collection) => [collection._id, collection.title]),
		);

		return childCollections.map((collection) => ({
			...collection,
			title: collection.parent?.$id
				? `${titles.get(collection.parent.$id) ?? "Nested"} / ${collection.title}`
				: collection.title,
		}));
	}, [childCollections, rootCollections]);

	const allCollections = useMemo(
		() =>
			uniqueCollections([
				...BUILT_IN_COLLECTIONS,
				...rootCollections,
				...childCollectionTitles,
			]),
		[childCollectionTitles, rootCollections],
	);

	const moveTargetCollections = useMemo(
		() =>
			allCollections.filter((collection) =>
				isMoveTargetCollection(collection, selectedCollectionId),
			),
		[allCollections, selectedCollectionId],
	);

	const selectedCollectionTitle = useMemo(() => {
		return (
			allCollections.find(
				(collection) => collection._id.toString() === selectedCollectionId,
			)?.title ?? "Bookmarks"
		);
	}, [allCollections, selectedCollectionId]);

	const collectionSuggestions = useMemo(() => {
		const query = normalize(searchText);

		if (query.length < 2) return [];

		return uniqueCollectionSuggestions(
			allCollections
				.filter(
					(collection) => collection._id.toString() !== selectedCollectionId,
				)
				.map((collection) => ({
					collection,
					score: getCollectionMatchScore(collection.title, query),
				}))
				.filter(({ score }) => score > 0)
				.sort((left, right) => right.score - left.score)
				.map(({ collection }) => collection),
		).slice(0, MAX_COLLECTION_SUGGESTIONS);
	}, [allCollections, searchText, selectedCollectionId]);

	const hasMoreRaindrops = raindrops.length < raindropsCount;

	const loadMoreRaindrops = useCallback(async () => {
		if (isLoadingRaindrops || isLoadingMore || !hasMoreRaindrops) return;

		const queryKey = activeQueryKey;
		const requestId = requestIdRef.current;
		const pageToLoad = nextPage;
		setIsLoadingMore(true);
		setLoadMoreError(undefined);

		try {
			const data = await fetchRaindrops(request, {
				collectionId: selectedCollectionId,
				page: pageToLoad,
				perPage: RAINDROPS_PER_PAGE,
				search: debouncedSearchText,
			});

			if (!data.result) {
				throw new Error(data.errorMessage ?? "Raindrop.io API request failed");
			}

			if (
				activeQueryKeyRef.current !== queryKey ||
				requestIdRef.current !== requestId
			)
				return;

			const count = data.count ?? raindropsCount;
			const nextPage = pageToLoad + 1;
			setRaindrops((items) => {
				const mergedItems = sortFavoriteFirst(
					mergeRaindropsById(items, data.items ?? []),
				);
				const loadedPages = Array.from(
					{ length: nextPage },
					(_value, index) => index,
				);
				raindropsQueryCache.set(queryKey, {
					items: mergedItems,
					count,
					nextPage,
				});
				writeQuery(accountKey, {
					collectionId: selectedCollectionId,
					search: debouncedSearchText,
					items: mergedItems,
					count,
					nextPage,
					loadedPages,
					isComplete: mergedItems.length >= count,
					source: "query",
				});
				return mergedItems;
			});
			setRaindropsCount(count);
			setNextPage(nextPage);
		} catch (error) {
			const message = getErrorMessage(error, "Failed to load more bookmarks");

			if (
				activeQueryKeyRef.current !== queryKey ||
				requestIdRef.current !== requestId
			)
				return;
			setLoadMoreError(message);
			showToast(
				Toast.Style.Failure,
				"Failed to load more Raindrop.io bookmarks",
				message,
			);
		} finally {
			if (
				activeQueryKeyRef.current === queryKey &&
				requestIdRef.current === requestId
			) {
				setIsLoadingMore(false);
			}
		}
	}, [
		accountKey,
		activeQueryKey,
		debouncedSearchText,
		hasMoreRaindrops,
		isLoadingMore,
		isLoadingRaindrops,
		nextPage,
		raindropsCount,
		request,
		selectedCollectionId,
	]);

	const handleCollectionDropdownChange = useCallback(
		(collectionId: string) => {
			if (collectionId !== selectedCollectionId) {
				push(<RaindropBookmarks initialCollectionId={collectionId} />);
			}
		},
		[push, selectedCollectionId],
	);

	const renameBookmark = useCallback(
		async (id: number, title: string) => {
			try {
				const data = await request<MutationResponse>(
					`/raindrop/${id}`,
					jsonRequestInit("PUT", { title }),
				);
				ensureMutationResult(data, "Could not rename bookmark");
				patchCachedRaindrop(accountKey, id, { title });
				clearCachedQueries(accountKey);

				setRaindrops((items) =>
					items.map((item) => (item._id === id ? { ...item, title } : item)),
				);
				refresh();
				showToast(Toast.Style.Success, "Bookmark renamed");
			} catch (error) {
				showToast(
					Toast.Style.Failure,
					"Could not rename bookmark",
					getErrorMessage(error, "Rename failed"),
				);
				throw error;
			}
		},
		[accountKey, refresh, request],
	);

	const toggleFavorite = useCallback(
		async (raindrop: Raindrop) => {
			const nextImportant = !raindrop.important;

			try {
				const data = await request<MutationResponse>(
					`/raindrops/${getMutationCollectionId(selectedCollectionId, raindrop)}`,
					jsonRequestInit("PUT", {
						ids: [raindrop._id],
						important: nextImportant,
					}),
				);
				ensureMutationResult(data, "Could not update favorite");
				patchCachedRaindrop(accountKey, raindrop._id, {
					important: nextImportant,
				});

				setRaindrops((items) =>
					sortFavoriteFirst(
						items.map((item) =>
							item._id === raindrop._id
								? { ...item, important: nextImportant }
								: item,
						),
					),
				);
				refresh();
				showToast(
					Toast.Style.Success,
					nextImportant ? "Marked as favorite" : "Unmarked as favorite",
				);
			} catch (error) {
				showToast(
					Toast.Style.Failure,
					"Could not update favorite",
					getErrorMessage(error, "Favorite update failed"),
				);
			}
		},
		[accountKey, refresh, request, selectedCollectionId],
	);

	const moveBookmark = useCallback(
		async (raindrop: Raindrop, collection: Collection) => {
			try {
				const data = await request<MutationResponse>(
					`/raindrops/${getMutationCollectionId(selectedCollectionId, raindrop)}`,
					jsonRequestInit("PUT", {
						ids: [raindrop._id],
						collection: { $id: collection._id },
					}),
				);
				ensureMutationResult(data, "Could not move bookmark");
				patchCachedRaindrop(accountKey, raindrop._id, {
					collection: { $id: collection._id },
				});
				clearCachedQueries(accountKey);

				if (
					selectedCollectionId !== ALL_BOOKMARKS_COLLECTION_ID.toString() &&
					selectedCollectionId !== collection._id.toString()
				) {
					setRaindrops((items) =>
						items.filter((item) => item._id !== raindrop._id),
					);
				} else {
					setRaindrops((items) =>
						items.map((item) =>
							item._id === raindrop._id
								? { ...item, collection: { $id: collection._id } }
								: item,
						),
					);
				}

				refresh();
				showToast(
					Toast.Style.Success,
					`Moved to ${getCollectionName(collection)}`,
				);
			} catch (error) {
				showToast(
					Toast.Style.Failure,
					"Could not move bookmark",
					getErrorMessage(error, "Move failed"),
				);
			}
		},
		[accountKey, refresh, request, selectedCollectionId],
	);

	const deleteBookmark = useCallback(
		async (raindrop: Raindrop) => {
			const isPermanentDelete =
				selectedCollectionId === TRASH_COLLECTION_ID.toString();
			const actionTitle = isPermanentDelete
				? "Delete Permanently"
				: "Move to Trash";
			const confirmed = await confirmAlert({
				title: `${actionTitle}?`,
				message: raindrop.title || raindrop.link,
				icon: Icon.Trash,
				primaryAction: {
					title: actionTitle,
					style: Alert.ActionStyle.Destructive,
				},
				dismissAction: {
					title: "Cancel",
					style: Alert.ActionStyle.Cancel,
				},
			});

			if (!confirmed) return;

			try {
				const data = await request<MutationResponse>(
					`/raindrops/${isPermanentDelete ? TRASH_COLLECTION_ID : getMutationCollectionId(selectedCollectionId, raindrop)}`,
					jsonRequestInit("DELETE", { ids: [raindrop._id] }),
				);
				ensureMutationResult(data, `Could not ${actionTitle.toLowerCase()}`);
				removeCachedRaindrop(accountKey, raindrop._id);

				setRaindrops((items) =>
					items.filter((item) => item._id !== raindrop._id),
				);
				refresh();
				showToast(Toast.Style.Success, `${actionTitle} complete`);
			} catch (error) {
				showToast(
					Toast.Style.Failure,
					`Could not ${actionTitle.toLowerCase()}`,
					getErrorMessage(error, `${actionTitle} failed`),
				);
			}
		},
		[accountKey, refresh, request, selectedCollectionId],
	);

	const emptyView = useMemo(() => {
		if (error) {
			return (
				<List.EmptyView
					icon={Icon.Warning}
					title="Could not load bookmarks"
					description={error}
				/>
			);
		}

		return <List.EmptyView icon={Icon.Bookmark} title="No bookmarks found" />;
	}, [error]);
	const shouldShowEmptyView =
		!isLoadingRaindrops &&
		collectionSuggestions.length === 0 &&
		raindrops.length === 0;

	return (
		<List
			isLoading={isLoadingRaindrops}
			isShowingDetail
			onSearchTextChange={setSearchText}
			searchBarPlaceholder={`Search in ${selectedCollectionTitle} or type a collection name...`}
			filtering={false}
			searchBarAccessory={
				<CollectionDropdown
					selectedCollectionId={selectedCollectionId}
					isLoading={isLoadingCollections}
					rootCollections={rootCollections}
					childCollectionTitles={childCollectionTitles}
					onChange={handleCollectionDropdownChange}
				/>
			}
		>
			{shouldShowEmptyView ? emptyView : null}

			<CollectionSuggestionsSection
				collections={collectionSuggestions}
				renderTarget={(collectionId) => (
					<RaindropBookmarks initialCollectionId={collectionId} />
				)}
			/>

			<BookmarkListSection
				title={selectedCollectionTitle}
				raindrops={raindrops}
				totalCount={raindropsCount}
				hasMore={hasMoreRaindrops}
				isLoadingMore={isLoadingMore}
				loadMoreError={loadMoreError}
				selectedCollectionId={selectedCollectionId}
				moveTargetCollections={moveTargetCollections}
				allCollections={allCollections}
				onLoadMore={loadMoreRaindrops}
				onRename={renameBookmark}
				onToggleFavorite={(raindrop) => void toggleFavorite(raindrop)}
				onMove={(raindrop, collection) =>
					void moveBookmark(raindrop, collection)
				}
				onDelete={(raindrop) => void deleteBookmark(raindrop)}
				onRefresh={refresh}
				renderAllBookmarksTarget={() => (
					<RaindropBookmarks
						initialCollectionId={ALL_BOOKMARKS_COLLECTION_ID.toString()}
					/>
				)}
			/>
		</List>
	);
}
