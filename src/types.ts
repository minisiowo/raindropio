export type Preferences = {
	apiToken: string;
};

export type Raindrop = {
	_id: number;
	title: string;
	link: string;
	excerpt?: string;
	domain?: string;
	cover?: string;
	tags?: string[];
	created?: string;
	lastUpdate?: string;
	important?: boolean;
	collection?: {
		$id: number;
	};
};

export type Collection = {
	_id: number;
	title: string;
	count?: number;
	parent?: {
		$id: number;
	};
};

export type RaindropsResponse = {
	result: boolean;
	items: Raindrop[];
	count: number;
	errorMessage?: string;
};

export type CollectionsResponse = {
	result: boolean;
	items: Collection[];
	errorMessage?: string;
};

export type MutationResponse = {
	result: boolean;
	modified?: number;
	item?: Raindrop;
	errorMessage?: string;
};

export type CreateRaindropInput = {
	link: string;
	title?: string;
	excerpt?: string;
	tags?: string[];
	important?: boolean;
	collection?: {
		$id: number;
	};
	pleaseParse?: Record<string, never>;
};

export type RaindropsQueryCacheEntry = {
	items: Raindrop[];
	count: number;
	nextPage: number;
};

export type CacheMetadata = {
	version: 1;
	accountKey: string;
	updatedAt: string;
	lastSuccessfulSyncAt?: string;
	queryKeys: string[];
};

export type CachedCollections = {
	version: 1;
	accountKey: string;
	updatedAt: string;
	rootCollections: Collection[];
	childCollections: Collection[];
};

export type CachedRaindropsQuerySource = "query" | "full-index";

export type CachedRaindropsQuery = {
	version: 1;
	accountKey: string;
	updatedAt: string;
	collectionId: string;
	search: string;
	items: Raindrop[];
	count: number;
	nextPage: number;
	loadedPages: number[];
	isComplete: boolean;
	source: CachedRaindropsQuerySource;
};

export type CachedRaindropsIndex = {
	version: 1;
	accountKey: string;
	updatedAt: string;
	items: Raindrop[];
	count: number;
	isComplete: boolean;
	nextPage: number;
};

export type RaindropBookmarksProps = {
	initialCollectionId?: string;
	initialTagFilter?: string;
};
