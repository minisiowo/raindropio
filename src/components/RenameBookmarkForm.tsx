import {
	Action,
	ActionPanel,
	Form,
	showToast,
	Toast,
	useNavigation,
} from "@vicinae/api";
import { useState } from "react";
import type { Raindrop } from "../types";

type RenameBookmarkFormProps = {
	raindrop: Raindrop;
	onRename: (id: number, title: string) => Promise<void>;
};

export function RenameBookmarkForm({
	raindrop,
	onRename,
}: RenameBookmarkFormProps) {
	const { pop } = useNavigation();
	const [titleError, setTitleError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);

	return (
		<Form
			isLoading={isLoading}
			navigationTitle="Rename Bookmark"
			actions={
				<ActionPanel>
					<Action.SubmitForm
						title="Rename Bookmark"
						onSubmit={async (values) => {
							const title = String(values.title ?? "").trim();

							if (!title) {
								setTitleError("Title is required");
								showToast(Toast.Style.Failure, "Title is required");
								return false;
							}

							setTitleError(undefined);
							setIsLoading(true);

							try {
								await onRename(raindrop._id, title);
								pop();
							} catch {
								return false;
							} finally {
								setIsLoading(false);
							}

							return true;
						}}
					/>
				</ActionPanel>
			}
		>
			<Form.TextField
				id="title"
				title="Title"
				defaultValue={raindrop.title}
				error={titleError}
				autoFocus
				onChange={() => setTitleError(undefined)}
			/>
		</Form>
	);
}
