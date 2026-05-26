import { Action, ActionPanel, Icon, List } from "@vicinae/api";
import type { ReactNode } from "react";
import type { Collection } from "../types";
import { getCollectionName, getCollectionSubtitle } from "../utils/collections";

type CollectionSuggestionsSectionProps = {
	collections: Collection[];
	renderTarget: (collectionId: string) => ReactNode;
};

export function CollectionSuggestionsSection({
	collections,
	renderTarget,
}: CollectionSuggestionsSectionProps) {
	if (collections.length === 0) return null;

	return (
		<List.Section title="Collections">
			{collections.map((collection) => (
				<List.Item
					key={`collection-${collection._id}`}
					title={getCollectionName(collection)}
					subtitle={getCollectionSubtitle(collection)}
					icon={Icon.Folder}
					keywords={[collection.title]}
					actions={
						<ActionPanel>
							<Action.Push
								title="Search in Collection"
								icon={Icon.MagnifyingGlass}
								target={renderTarget(collection._id.toString())}
							/>
						</ActionPanel>
					}
				/>
			))}
		</List.Section>
	);
}
