import { Action, ActionPanel, Icon, List } from "@vicinae/api";
import type { ReactNode } from "react";
import { formatBookmarkCount } from "../utils/collections";
import type { TagSuggestion } from "../utils/tags";

type TagSuggestionsSectionProps = {
	tags: TagSuggestion[];
	renderTarget: (tag: string) => ReactNode;
};

export function TagSuggestionsSection({
	tags,
	renderTarget,
}: TagSuggestionsSectionProps) {
	if (tags.length === 0) return null;

	return (
		<List.Section title="Tags">
			{tags.map(({ tag, count }) => (
				<List.Item
					key={`tag-${tag}`}
					title={`#${tag}`}
					subtitle={formatBookmarkCount(count)}
					icon={Icon.Tag}
					keywords={[tag]}
					actions={
						<ActionPanel>
							<Action.Push
								title="Filter by Tag"
								icon={Icon.Tag}
								target={renderTarget(tag)}
							/>
						</ActionPanel>
					}
				/>
			))}
		</List.Section>
	);
}
