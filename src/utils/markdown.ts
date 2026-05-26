import type { Raindrop } from "../types";

export function getMarkdownLink(raindrop: Raindrop) {
	return `[${escapeMarkdownLinkText(raindrop.title || raindrop.link)}](${raindrop.link})`;
}

export function escapeMarkdownLinkText(text: string) {
	return text.replace(/]/g, "\\]");
}
