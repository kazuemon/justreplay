export type Lap = {
	timeMs: number;
	durationMs: number;
};

export type Replay = {
	path: string;
	laps: Lap[];
};

export type ReplayTargetSource = {
	sceneItemId: number;
	sceneName: string;
	itemName: string;
};

export type PlayQueueItem = {
	path: string;
	name: string;
	startMs: number;
	durationMs: number;
};
