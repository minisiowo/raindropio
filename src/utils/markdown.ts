import type { Raindrop } from "../types";

export function getMarkdownLink(raindrop: Raindrop) {
	return `[${escapeMarkdownLinkText(raindrop.title || raindrop.link)}](${raindrop.link})`;
}

export function escapeMarkdownLinkText(text: string) {
	return text.replace(/]/g, "\\]");
}

export function formatDate(dateString?: string) {
	if (!dateString) return "—";
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) return "—";

	const pad = (n: number) => n.toString().padStart(2, "0");
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const min = pad(date.getMinutes());

	return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function getMarkdown(raindrop: Raindrop, collectionName = "Unknown") {
	const lines: string[] = [];

	if (raindrop.cover) {
		lines.push(`![Cover](${raindrop.cover})`);
	}

	lines.push(`# ${raindrop.title || "Untitled"}`);

	if (raindrop.excerpt?.trim()) {
		lines.push(`> ${raindrop.excerpt.trim()}`);
	}

	const tagsStr = raindrop.tags?.length
		? raindrop.tags.map((tag) => `\`${tag}\``).join(" ")
		: "—";

	lines.push(
		[
			"| Property | Description |",
			"| --- | --- |",
			`| **URL** | [${raindrop.domain || "link"}](${raindrop.link}) |`,
			`| **Collection** | ${collectionName} |`,
			`| **Created** | ${formatDate(raindrop.created)} |`,
			`| **Updated** | ${formatDate(raindrop.lastUpdate)} |`,
			`| **Tags** | ${tagsStr} |`,
		].join("\n"),
	);

	return lines.join("\n\n");
}
