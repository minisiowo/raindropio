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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	createRaindropRequest,
	ensureMutationResult,
	jsonRequestInit,
} from "../api/raindrop-api";
import {
	ALL_BOOKMARKS_COLLECTION_ID,
	BUILT_IN_COLLECTIONS,
	MAX_COLLECTION_SUGGESTIONS,
	TRASH_COLLECTION_ID,
} from "../constants";
import type {
	Collection,
	CollectionsResponse,
	MutationResponse,
	Preferences,
	Raindrop,
	RaindropBookmarksProps,
	RaindropsResponse,
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
import { sortFavoriteFirst } from "../utils/raindrops";
import { BookmarkListSection } from "./BookmarkListSection";
import { CollectionDropdown } from "./CollectionDropdown";
import { CollectionSuggestionsSection } from "./CollectionSuggestionsSection";

export default function RaindropBookmarks({
	initialCollectionId = ALL_BOOKMARKS_COLLECTION_ID.toString(),
}: RaindropBookmarksProps = {}) {
	const { apiToken } = getPreferenceValues<Preferences>();
	const { push } = useNavigation();
	const [raindrops, setRaindrops] = useState<Raindrop[]>([]);
	const [rootCollections, setRootCollections] = useState<Collection[]>([]);
	const [childCollections, setChildCollections] = useState<Collection[]>([]);
	const [selectedCollectionId] = useState(initialCollectionId);
	const [searchText, setSearchText] = useState("");
	const [isLoadingRaindrops, setIsLoadingRaindrops] = useState(true);
	const [isLoadingCollections, setIsLoadingCollections] = useState(true);
	const [error, setError] = useState<string>();
	const [refreshToken, setRefreshToken] = useState(0);

	const request = useMemo(() => createRaindropRequest(apiToken), [apiToken]);

	const refresh = useCallback(() => {
		setRefreshToken((current) => current + 1);
	}, []);

	useEffect(() => {
		void refreshToken;
		let isMounted = true;

		async function loadCollections() {
			setIsLoadingCollections(true);

			try {
				const [rootCollectionsResponse, childCollectionsResponse] =
					await Promise.all([
						request<CollectionsResponse>("/collections"),
						request<CollectionsResponse>("/collections/childrens"),
					]);

				if (!rootCollectionsResponse.result) {
					throw new Error(
						rootCollectionsResponse.errorMessage ??
							"Could not load root collections",
					);
				}

				if (!childCollectionsResponse.result) {
					throw new Error(
						childCollectionsResponse.errorMessage ??
							"Could not load child collections",
					);
				}

				if (!isMounted) return;
				setRootCollections(rootCollectionsResponse.items ?? []);
				setChildCollections(childCollectionsResponse.items ?? []);
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
	}, [request, refreshToken]);

	useEffect(() => {
		void refreshToken;
		let isMounted = true;

		async function loadRaindrops() {
			setIsLoadingRaindrops(true);
			setError(undefined);

			try {
				const data = await request<RaindropsResponse>(
					`/raindrops/${selectedCollectionId}?perpage=50&sort=-created&nested=true`,
				);

				if (!data.result) {
					throw new Error(
						data.errorMessage ?? "Raindrop.io API request failed",
					);
				}

				if (!isMounted) return;
				setRaindrops(sortFavoriteFirst(data.items ?? []));
			} catch (error) {
				const message = getErrorMessage(error, "Failed to load bookmarks");

				if (!isMounted) return;
				setError(message);
				showToast(
					Toast.Style.Failure,
					"Failed to load Raindrop.io bookmarks",
					message,
				);
			} finally {
				if (isMounted) setIsLoadingRaindrops(false);
			}
		}

		loadRaindrops();

		return () => {
			isMounted = false;
		};
	}, [request, selectedCollectionId, refreshToken]);

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
		[refresh, request],
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
		[refresh, request, selectedCollectionId],
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
		[refresh, request, selectedCollectionId],
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
		[refresh, request, selectedCollectionId],
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
		collectionSuggestions.length === 0 && raindrops.length === 0;

	return (
		<List
			isLoading={isLoadingRaindrops}
			isShowingDetail
			searchText={searchText}
			onSearchTextChange={setSearchText}
			searchBarPlaceholder={`Search in ${selectedCollectionTitle} or type a collection name...`}
			filtering
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
				selectedCollectionId={selectedCollectionId}
				moveTargetCollections={moveTargetCollections}
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
