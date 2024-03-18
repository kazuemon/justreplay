type Promisable<T> = T | Promise<T>;

export interface PlaySourceAdapter {
	onCheckConfiguration?: () => Promisable<boolean>;
	onPrepare?: (path: string, firstStartMs: number) => Promisable<void>;
	onStart?: () => Promisable<void>;
	seek: (ms: number) => Promisable<void>;
	pause: () => Promisable<void>;
	resume: () => Promisable<void>;
	onEnd?: () => Promisable<void>;
}
