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

export type RaindropBookmarksProps = {
	initialCollectionId?: string;
};
