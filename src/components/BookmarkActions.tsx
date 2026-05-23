import { Action, ActionPanel, Icon } from "@vicinae/api";
import type { ReactNode } from "react";
import { TRASH_COLLECTION_ID } from "../constants";
import type { Collection, Raindrop } from "../types";
import {
	getCollectionTitle,
	getMoveTargetCollections,
} from "../utils/collections";
import { getMarkdownLink } from "../utils/markdown";
import { RenameBookmarkForm } from "./RenameBookmarkForm";

type BookmarkActionsProps = {
	raindrop: Raindrop;
	selectedCollectionId: string;
	moveTargetCollections: Collection[];
	onRename: (id: number, title: string) => Promise<void>;
	onToggleFavorite: (raindrop: Raindrop) => void;
	onMove: (raindrop: Raindrop, collection: Collection) => void;
	onDelete: (raindrop: Raindrop) => void;
	onRefresh: () => void;
	renderAllBookmarksTarget: () => ReactNode;
};

export function BookmarkActions({
	raindrop,
	selectedCollectionId,
	moveTargetCollections,
	onRename,
	onToggleFavorite,
	onMove,
	onDelete,
	onRefresh,
	renderAllBookmarksTarget,
}: BookmarkActionsProps) {
	return (
		<ActionPanel>
			<ActionPanel.Section title="Open">
				<Action.OpenInBrowser title="Open Bookmark" url={raindrop.link} />
			</ActionPanel.Section>

			<ActionPanel.Section title="Copy">
				<Action.CopyToClipboard title="Copy URL" content={raindrop.link} />
				<Action.CopyToClipboard
					title="Copy Title"
					content={raindrop.title || raindrop.link}
				/>
				<Action.CopyToClipboard
					title="Copy Markdown Link"
					content={getMarkdownLink(raindrop)}
				/>
			</ActionPanel.Section>

			<ActionPanel.Section title="Edit">
				<Action.Push
					title="Rename Bookmark"
					icon={Icon.Pencil}
					target={
						<RenameBookmarkForm raindrop={raindrop} onRename={onRename} />
					}
				/>
				<Action
					title={raindrop.important ? "Unmark as Favorite" : "Mark as Favorite"}
					icon={raindrop.important ? Icon.StarDisabled : Icon.Star}
					onAction={() => onToggleFavorite(raindrop)}
				/>
				<ActionPanel.Submenu title="Move to Collection" icon={Icon.Folder}>
					{getMoveTargetCollections(moveTargetCollections, raindrop).map(
						(collection) => (
							<Action
								key={collection._id}
								title={getCollectionTitle(collection)}
								onAction={() => onMove(raindrop, collection)}
							/>
						),
					)}
				</ActionPanel.Submenu>
			</ActionPanel.Section>

			<ActionPanel.Section title="Navigation">
				<Action
					title="Refresh"
					icon={Icon.ArrowClockwise}
					onAction={onRefresh}
				/>
				<Action.Push
					title="Search All Bookmarks"
					icon={Icon.Globe}
					target={renderAllBookmarksTarget()}
				/>
			</ActionPanel.Section>

			<ActionPanel.Section title="Danger Zone">
				<Action
					title={
						selectedCollectionId === TRASH_COLLECTION_ID.toString()
							? "Delete Permanently"
							: "Move to Trash"
					}
					icon={Icon.Trash}
					style={Action.Style.Destructive}
					onAction={() => onDelete(raindrop)}
				/>
			</ActionPanel.Section>
		</ActionPanel>
	);
}
