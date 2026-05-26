import { Action, ActionPanel, Icon, List } from "@vicinae/api";
import type { ReactNode } from "react";
import type { Collection, Raindrop } from "../types";
import { BookmarkActions } from "./BookmarkActions";

type BookmarkListSectionProps = {
	title: string;
	raindrops: Raindrop[];
	totalCount: number;
	hasMore: boolean;
	isLoadingMore: boolean;
	loadMoreError?: string;
	selectedCollectionId: string;
	moveTargetCollections: Collection[];
	onLoadMore: () => void;
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
	totalCount,
	hasMore,
	isLoadingMore,
	loadMoreError,
	selectedCollectionId,
	moveTargetCollections,
	onLoadMore,
	onRename,
	onToggleFavorite,
	onMove,
	onDelete,
	onRefresh,
	renderAllBookmarksTarget,
}: BookmarkListSectionProps) {
	const subtitle =
		totalCount > raindrops.length
			? `${raindrops.length} of ${totalCount}`
			: `${raindrops.length}`;
	const loadMoreTitle = loadMoreError
		? "Retry Loading More"
		: isLoadingMore
			? "Loading More..."
			: "Load More";
	const loadMoreSubtitle = loadMoreError
		? loadMoreError
		: `Showing ${raindrops.length} of ${totalCount}`;

	return (
		<List.Section title={title} subtitle={subtitle}>
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
			{hasMore ? (
				<List.Item
					key="load-more-bookmarks"
					title={loadMoreTitle}
					subtitle={loadMoreSubtitle}
					icon={Icon.ArrowDown}
					actions={
						<ActionPanel>
							<Action
								title={
									loadMoreError ? "Retry Loading More" : "Load More Bookmarks"
								}
								icon={Icon.ArrowDown}
								onAction={onLoadMore}
							/>
						</ActionPanel>
					}
				/>
			) : null}
		</List.Section>
	);
}
