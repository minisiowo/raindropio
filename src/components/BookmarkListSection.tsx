import { Icon, List } from "@vicinae/api";
import type { ReactNode } from "react";
import type { Collection, Raindrop } from "../types";
import { getMarkdown } from "../utils/markdown";
import { BookmarkActions } from "./BookmarkActions";

type BookmarkListSectionProps = {
	title: string;
	raindrops: Raindrop[];
	selectedCollectionId: string;
	moveTargetCollections: Collection[];
	onRename: (id: number, title: string) => Promise<void>;
	onToggleFavorite: (raindrop: Raindrop) => void;
	onMove: (raindrop: Raindrop, collection: Collection) => void;
	onDelete: (raindrop: Raindrop) => void;
	onRefresh: () => void;
	renderAllBookmarksTarget: () => ReactNode;
};

export function BookmarkListSection({
	title,
	raindrops,
	selectedCollectionId,
	moveTargetCollections,
	onRename,
	onToggleFavorite,
	onMove,
	onDelete,
	onRefresh,
	renderAllBookmarksTarget,
}: BookmarkListSectionProps) {
	return (
		<List.Section title={title} subtitle={`${raindrops.length}`}>
			{raindrops.map((raindrop) => (
				<List.Item
					key={raindrop._id}
					title={raindrop.title || raindrop.link}
					subtitle={raindrop.domain}
					icon={raindrop.cover || Icon.Bookmark}
					accessories={
						raindrop.important ? [{ icon: Icon.Star, tooltip: "Favorite" }] : []
					}
					keywords={
						[raindrop.domain, ...(raindrop.tags ?? [])].filter(
							Boolean,
						) as string[]
					}
					detail={<List.Item.Detail markdown={getMarkdown(raindrop)} />}
					actions={
						<BookmarkActions
							raindrop={raindrop}
							selectedCollectionId={selectedCollectionId}
							moveTargetCollections={moveTargetCollections}
							onRename={onRename}
							onToggleFavorite={onToggleFavorite}
							onMove={onMove}
							onDelete={onDelete}
							onRefresh={onRefresh}
							renderAllBookmarksTarget={renderAllBookmarksTarget}
						/>
					}
				/>
			))}
		</List.Section>
	);
}
