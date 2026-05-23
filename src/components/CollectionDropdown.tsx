import { Icon, List } from "@vicinae/api";
import {
	ALL_BOOKMARKS_COLLECTION_ID,
	BUILT_IN_COLLECTIONS,
	TRASH_COLLECTION_ID,
	UNSORTED_COLLECTION_ID,
} from "../constants";
import type { Collection } from "../types";
import { getCollectionTitle } from "../utils/collections";

type CollectionDropdownProps = {
	selectedCollectionId: string;
	isLoading: boolean;
	rootCollections: Collection[];
	childCollectionTitles: Collection[];
	onChange: (collectionId: string) => void;
};

function getBuiltInCollectionIcon(id: number) {
	switch (id) {
		case ALL_BOOKMARKS_COLLECTION_ID:
			return Icon.Globe;
		case UNSORTED_COLLECTION_ID:
			return Icon.Tray;
		case TRASH_COLLECTION_ID:
			return Icon.Trash;
		default:
			return Icon.Bookmark;
	}
}

export function CollectionDropdown({
	selectedCollectionId,
	isLoading,
	rootCollections,
	childCollectionTitles,
	onChange,
}: CollectionDropdownProps) {
	return (
		<List.Dropdown
			tooltip="Collection"
			value={selectedCollectionId}
			onChange={onChange}
			isLoading={isLoading}
		>
			<List.Dropdown.Section title="Built-in">
				{BUILT_IN_COLLECTIONS.map((collection) => (
					<List.Dropdown.Item
						key={collection._id}
						title={collection.title}
						value={collection._id.toString()}
						icon={getBuiltInCollectionIcon(collection._id)}
					/>
				))}
			</List.Dropdown.Section>
			<List.Dropdown.Section title="Collections">
				{rootCollections.map((collection) => (
					<List.Dropdown.Item
						key={collection._id}
						title={getCollectionTitle(collection)}
						value={collection._id.toString()}
						icon={Icon.Folder}
					/>
				))}
			</List.Dropdown.Section>
			<List.Dropdown.Section title="Nested Collections">
				{childCollectionTitles.map((collection) => (
					<List.Dropdown.Item
						key={collection._id}
						title={getCollectionTitle(collection)}
						value={collection._id.toString()}
						icon={Icon.Folder}
					/>
				))}
			</List.Dropdown.Section>
		</List.Dropdown>
	);
}
