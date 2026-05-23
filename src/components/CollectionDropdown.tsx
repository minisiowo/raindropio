import { List } from "@vicinae/api";
import { BUILT_IN_COLLECTIONS } from "../constants";
import type { Collection } from "../types";
import { getCollectionTitle } from "../utils/collections";

type CollectionDropdownProps = {
	selectedCollectionId: string;
	isLoading: boolean;
	rootCollections: Collection[];
	childCollectionTitles: Collection[];
	onChange: (collectionId: string) => void;
};

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
					/>
				))}
			</List.Dropdown.Section>
			<List.Dropdown.Section title="Collections">
				{rootCollections.map((collection) => (
					<List.Dropdown.Item
						key={collection._id}
						title={getCollectionTitle(collection)}
						value={collection._id.toString()}
					/>
				))}
			</List.Dropdown.Section>
			<List.Dropdown.Section title="Nested Collections">
				{childCollectionTitles.map((collection) => (
					<List.Dropdown.Item
						key={collection._id}
						title={getCollectionTitle(collection)}
						value={collection._id.toString()}
					/>
				))}
			</List.Dropdown.Section>
		</List.Dropdown>
	);
}
