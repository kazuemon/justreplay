import type { Dispatch, RefObject, SetStateAction } from "react";
import type { PlaySourceAdapter } from "./base";
import type ReactPlayer from "react-player";

export class ReactPlayerAdapter implements PlaySourceAdapter {
	constructor(
		private setUrl: Dispatch<SetStateAction<string>>,
		private setPlaying: Dispatch<SetStateAction<boolean>>,
		private ref: RefObject<ReactPlayer>,
	) {}

	onPrepare(path: string, firstStartMs: number) {
		this.pause();
		this.setUrl(`file:///${path}`);
		this.seek(firstStartMs);
	}

	seek(ms: number) {
		this.ref.current?.seekTo(ms / 1000, "seconds");
	}

	pause() {
		this.setPlaying(false);
	}

	resume() {
		this.setPlaying(true);
	}
}
