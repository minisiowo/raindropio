import {
	Action,
	ActionPanel,
	Clipboard,
	Form,
	getPreferenceValues,
	Icon,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import {
	createElement,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	createRaindrop,
	createRaindropRequest,
	ensureMutationResult,
} from "../api/raindrop-api";
import {
	clearCachedQueries,
	getRaindropAccountKey,
	readCollections,
	removeAllIndex,
	writeCollections,
} from "../cache/raindrop-cache";
import { UNSORTED_COLLECTION_ID } from "../constants";
import { fetchCollections } from "../sync/raindrop-sync";
import type { Collection, CreateRaindropInput, Preferences } from "../types";
import { getCollectionTitle, uniqueCollections } from "../utils/collections";

type CollectionOption = {
	collection: Collection;
	icon: Icon;
};

type QuickAddBookmarkFormValues = {
	url: string;
	title: string;
	collectionId: string;
	tags: string;
	important: boolean;
};

export default function QuickAddBookmarkForm() {
	const { apiToken } = getPreferenceValues<Preferences>();
	const request = useMemo(() => createRaindropRequest(apiToken), [apiToken]);
	const accountKey = useMemo(() => getRaindropAccountKey(apiToken), [apiToken]);
	const { pop } = useNavigation();

	const [url, setUrl] = useState("");
	const [title, setTitle] = useState("");
	const [collectionId, setCollectionId] = useState(
		UNSORTED_COLLECTION_ID.toString(),
	);
	const [tags, setTags] = useState("");
	const [important, setImportant] = useState(false);
	const [urlError, setUrlError] = useState<string>();
	const [rootCollections, setRootCollections] = useState<Collection[]>([]);
	const [childCollections, setChildCollections] = useState<Collection[]>([]);
	const [isLoadingCollections, setIsLoadingCollections] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		let isMounted = true;

		async function prefillUrlFromClipboard() {
			let clipboardText: string | undefined;
			try {
				clipboardText = await Clipboard.readText();
			} catch {
				return;
			}

			if (!isMounted || !clipboardText) return;

			const normalizedUrl = normalizeUrlInput(clipboardText);
			if (normalizedUrl) setUrl(normalizedUrl);
		}

		void prefillUrlFromClipboard();

		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let isMounted = true;

		async function loadCollections() {
			const cachedCollections = readCollections(accountKey);
			if (cachedCollections) {
				setRootCollections(cachedCollections.rootCollections);
				setChildCollections(cachedCollections.childCollections);
			} else {
				setIsLoadingCollections(true);
			}

			try {
				const collections = await fetchCollections(request);
				if (!isMounted) return;

				writeCollections(accountKey, collections);
				setRootCollections(collections.rootCollections);
				setChildCollections(collections.childCollections);
			} catch {
				if (isMounted && !cachedCollections) {
					void showToast(Toast.Style.Failure, "Could not load collections");
				}
			} finally {
				if (isMounted) setIsLoadingCollections(false);
			}
		}

		void loadCollections();

		return () => {
			isMounted = false;
		};
	}, [accountKey, request]);

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

	const collectionOptions = useMemo<CollectionOption[]>(() => {
		return [
			{
				collection: { _id: UNSORTED_COLLECTION_ID, title: "Unsorted" },
				icon: Icon.Tray,
			},
			...uniqueCollections(rootCollections).map((collection) => ({
				collection,
				icon: Icon.Folder,
			})),
			...uniqueCollections(childCollectionTitles).map((collection) => ({
				collection,
				icon: Icon.Folder,
			})),
		];
	}, [childCollectionTitles, rootCollections]);

	const handleSubmit = useCallback(
		async (values: QuickAddBookmarkFormValues) => {
			const normalizedUrl = normalizeUrlInput(values.url);
			if (!normalizedUrl) {
				setUrlError("Enter a valid HTTP or HTTPS URL");
				void showToast(Toast.Style.Failure, "Enter a valid URL");
				return false;
			}

			setUrlError(undefined);
			setIsSubmitting(true);

			const parsedTags = parseTags(values.tags);
			const input: CreateRaindropInput = {
				link: normalizedUrl,
				title: values.title.trim() || undefined,
				tags: parsedTags.length ? parsedTags : undefined,
				important: values.important,
				collection: { $id: Number(values.collectionId) },
				pleaseParse: {},
			};

			try {
				const data = await createRaindrop(request, input);
				ensureMutationResult(data, "Could not add bookmark");
				clearCachedQueries(accountKey);
				removeAllIndex(accountKey);
				void showToast(Toast.Style.Success, "Bookmark added");
				pop();
			} catch {
				void showToast(Toast.Style.Failure, "Could not add bookmark");
				return false;
			} finally {
				setIsSubmitting(false);
			}

			return true;
		},
		[accountKey, pop, request],
	);

	return (
		<Form
			isLoading={isLoadingCollections || isSubmitting}
			navigationTitle="Quick Add Bookmark"
			actions={
				<ActionPanel>
					<Action.SubmitForm
						title="Add Bookmark"
						onSubmit={(values) =>
							handleSubmit({
								url: String(values.url ?? ""),
								title: String(values.title ?? ""),
								collectionId: String(
									values.collectionId ?? UNSORTED_COLLECTION_ID,
								),
								tags: String(values.tags ?? ""),
								important: Boolean(values.important),
							})
						}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField
				id="url"
				title="URL"
				value={url}
				error={urlError}
				autoFocus
				onChange={(value) => {
					setUrl(value);
					setUrlError(undefined);
				}}
			/>
			<Form.TextField
				id="title"
				title="Title"
				value={title}
				onChange={setTitle}
			/>
			<Form.Dropdown
				id="collectionId"
				title="Collection"
				value={collectionId}
				isLoading={isLoadingCollections}
				onChange={setCollectionId}
			>
				{createElement(
					"dropdown-section",
					{ title: "Collections" },
					collectionOptions.map(({ collection, icon }) =>
						createElement("dropdown-item", {
							key: collection._id,
							title: getCollectionTitle(collection),
							value: collection._id.toString(),
							icon,
						}),
					),
				)}
			</Form.Dropdown>
			<Form.TextField id="tags" title="Tags" value={tags} onChange={setTags} />
			<Form.Checkbox
				id="important"
				title="Favorite"
				label="Mark as favorite"
				value={important}
				onChange={setImportant}
			/>
		</Form>
	);
}

function normalizeUrlInput(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	try {
		const url = new URL(trimmed);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return undefined;
		}

		return url.toString();
	} catch {
		return undefined;
	}
}

function parseTags(value: string) {
	return Array.from(
		new Set(
			value
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	);
}
