import type { Raindrop } from "../types";

export function getMarkdownLink(raindrop: Raindrop) {
	return `[${escapeMarkdownLinkText(raindrop.title || raindrop.link)}](${raindrop.link})`;
}

export function escapeMarkdownLinkText(text: string) {
	return text.replace(/]/g, "\\]");
}

export function getMarkdown(raindrop: Raindrop) {
	const lines = [
		`# ${raindrop.title || "Untitled"}`,
		raindrop.excerpt,
		`[${raindrop.link}](${raindrop.link})`,
		raindrop.tags?.length
			? `Tags: ${raindrop.tags.map((tag) => `\`${tag}\``).join(" ")}`
			: undefined,
		raindrop.created
			? `Created: ${new Date(raindrop.created).toLocaleString()}`
			: undefined,
	];

	return lines.filter(Boolean).join("\n\n");
}
