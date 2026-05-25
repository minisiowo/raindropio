import { RAINDROP_API_BASE_URL } from "../constants";
import type {
	CollectionsResponse,
	MutationResponse,
	RaindropsResponse,
} from "../types";

export type RaindropRequest = <T>(
	path: string,
	init?: RequestInit,
) => Promise<T>;

export type GetRaindropsOptions = {
	collectionId: string;
	page: number;
	perPage: number;
	search?: string;
};

export function createRaindropRequest(apiToken: string): RaindropRequest {
	return async function request<T>(path: string, init?: RequestInit) {
		const headers = new Headers(init?.headers);
		headers.set("Authorization", `Bearer ${apiToken}`);

		const response = await fetch(`${RAINDROP_API_BASE_URL}${path}`, {
			...init,
			headers,
		});
		const responseText = await response.text();
		const data = parseJsonResponse(responseText) as
			| (T & { errorMessage?: string })
			| undefined;

		if (!response.ok) {
			throw new Error(
				data?.errorMessage ?? `Raindrop.io API returned ${response.status}`,
			);
		}

		return (data ?? {}) as T;
	};
}

export function getRaindropsPath({
	collectionId,
	page,
	perPage,
	search,
}: GetRaindropsOptions) {
	const trimmedSearch = search?.trim();
	const params = new URLSearchParams({
		page: page.toString(),
		perpage: perPage.toString(),
		sort: trimmedSearch ? "score" : "-created",
		nested: "true",
	});

	if (trimmedSearch) params.set("search", trimmedSearch);

	return `/raindrops/${collectionId}?${params.toString()}`;
}

export function fetchRaindrops(
	request: RaindropRequest,
	options: GetRaindropsOptions,
) {
	return request<RaindropsResponse>(getRaindropsPath(options));
}

export function fetchRootCollections(request: RaindropRequest) {
	return request<CollectionsResponse>("/collections");
}

export function fetchChildCollections(request: RaindropRequest) {
	return request<CollectionsResponse>("/collections/childrens");
}

export function jsonRequestInit(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	};
}

export function parseJsonResponse(responseText: string) {
	if (!responseText) return undefined;

	try {
		return JSON.parse(responseText) as unknown;
	} catch {
		return undefined;
	}
}

export function ensureMutationResult(
	data: MutationResponse,
	fallbackMessage: string,
) {
	if (!data.result) {
		throw new Error(data.errorMessage ?? fallbackMessage);
	}
}
