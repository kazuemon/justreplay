import consola from "consola";
import type { ReplayTargetSource } from "../../replay.types";
import { client } from "../obs";
import type { PlaySourceAdapter } from "./base";
import retry from "async-await-retry";

const logger = consola.withTag("vlc-adapter");
logger.level = 5;

type VLCSourceAdapterOptions = {
	in: {
		autoTransition: boolean;
		playBeforeTransition: boolean;
		transitionPointMs?: number;
	};
	out: {
		autoTransition: boolean;
		sceneName?: string;
		keepPlayingDuringTransition: boolean;
		transitionPointMs?: number;
	};
};

export class VLCSourceAdapter implements PlaySourceAdapter {
	constructor(
		private options: VLCSourceAdapterOptions,
		private source: ReplayTargetSource,
	) {}

	onCheckConfiguration() {
		return true;
	}

	async onPrepare(path: string, firstStartMs: number): Promise<void> {
		// Set path and Play for load replay
		await client.callBatch([
			{
				requestType: "SetSceneItemEnabled",
				requestData: {
					sceneName: this.source.sceneName,
					sceneItemEnabled: false,
					sceneItemId: this.source.sceneItemId,
				},
			},
			{
				requestType: "SetInputSettings",
				requestData: {
					inputName: this.source.itemName,
					inputSettings: {
						playlist: [
							{
								hidden: false,
								selected: false,
								value: path,
							},
						],
					},
				},
			},
			{
				requestType: "TriggerMediaInputAction",
				requestData: {
					inputName: this.source.itemName,
					mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY",
				},
			},
		]);

		// Pool
		logger.debug("Start detection of video load completion");
		await retry(
			async () => {
				const resp = await client.call("GetMediaInputStatus", {
					inputName: this.source.itemName,
				});
				logger.debug("Checking...", resp);
				if (
					resp.mediaCursor === null ||
					resp.mediaDuration === null ||
					resp.mediaCursor <= 0 ||
					resp.mediaDuration <= 0
				)
					throw new Error();
			},
			[],
			{
				retriesMax: 10,
				interval: 200,
				exponential: false,
			},
		);
		logger.debug("Video loading complete ✅");

		logger.debug("Pausing video...");
		await this.pause();

		// Seek
		logger.debug("Seek to first start position");
		await client.call("SetMediaInputCursor", {
			inputName: this.source.itemName,
			mediaCursor: firstStartMs,
		});

		// Check seeked
		logger.debug("Last Check 🕵️‍♂️");
		let currentMediaCursor = -1;
		try {
			await retry(
				async () => {
					const resp = await client.call("GetMediaInputStatus", {
						inputName: this.source.itemName,
					});
					logger.debug("Checking...", resp);
					currentMediaCursor = resp.mediaCursor;
					if (currentMediaCursor !== firstStartMs) throw new Error();
				},
				[],
				{
					interval: 50,
					retriesMax: 10,
					exponential: false,
				},
			);
		} catch (e) {
			logger.error(
				"Preparation has not been completed successfully: Mismatch of stop position",
				currentMediaCursor,
				firstStartMs,
			);
		}

		logger.debug("Complete!");
	}

	async onStart(): Promise<void> {
		// Show
		await client.call("SetSceneItemEnabled", {
			sceneName: this.source.sceneName,
			sceneItemEnabled: true,
			sceneItemId: this.source.sceneItemId,
		});
		// Transition
		if (this.options.in.autoTransition) {
			await client.call("SetCurrentProgramScene", {
				sceneName: this.source.sceneName,
			});
		} else {
			logger.info("AutoTransition is off! Please switch scenes manually.");
		}
		// If options.transitionPointMs, use setTimeout
		if (
			this.options.in.playBeforeTransition &&
			this.options.in.transitionPointMs !== undefined
		) {
			if (!this.options.in.autoTransition) {
				// Wait for start transition
				await new Promise<void>((resolve) => {
					const onTransitionStarted = async () => {
						try {
							await retry(
								async () => {
									const current = await client.call("GetCurrentProgramScene");
									if (current.currentProgramSceneName !== this.source.sceneName)
										throw new Error();
								},
								[],
								{
									interval: 20,
									retriesMax: 5,
									exponential: false,
								},
							);
							client.off("SceneTransitionStarted", onTransitionStarted);
							resolve();
						} catch (e) {
							logger.info(
								"The transition has started, but the replay will not play because the scene has not switched to the one containing the replay source.",
							);
						}
					};
					client.on("SceneTransitionStarted", onTransitionStarted);
				});
			}
			await new Promise<void>((resolve) => {
				setTimeout(() => resolve(), this.options.in.transitionPointMs);
			});
		} else {
			// Wait for end transition
			await new Promise<void>((resolve) => {
				const onTransitionEnded = async () => {
					const current = await client.call("GetCurrentProgramScene");
					if (current.currentProgramSceneName === this.source.sceneName) {
						client.off("SceneTransitionEnded", onTransitionEnded);
						resolve();
					} else {
						logger.info(
							"The transition has ended, but the replay will not play because the scene has not switched to the one containing the replay source.",
						);
					}
				};
				client.on("SceneTransitionEnded", onTransitionEnded);
			});
		}
		// Play
		await client.call("TriggerMediaInputAction", {
			inputName: this.source.itemName,
			mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY",
		});
	}

	async seek(ms: number): Promise<void> {
		await client.call("SetMediaInputCursor", {
			inputName: this.source.itemName,
			mediaCursor: ms,
		});
	}

	async pause(): Promise<void> {
		let previousCursor = -1;
		await retry(
			async () => {
				const resp = await client.call("GetMediaInputStatus", {
					inputName: this.source.itemName,
				});
				logger.debug("Checking...", resp, previousCursor);
				if (resp.mediaState !== "OBS_MEDIA_STATE_PAUSED") {
					await client.call("TriggerMediaInputAction", {
						inputName: this.source.itemName,
						mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE",
					});
					previousCursor = -1;
					throw new Error();
				}
				const _prevCursor = previousCursor;
				previousCursor = resp.mediaCursor;
				if (resp.mediaCursor !== _prevCursor) throw new Error();
			},
			[],
			{
				retriesMax: 20,
				interval: 80,
				exponential: false,
			},
		);
	}

	async resume(): Promise<void> {
		await client.call("TriggerMediaInputAction", {
			inputName: this.source.itemName,
			mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY",
		});
	}

	async onEnd(): Promise<void> {
		await client.call("SetCurrentProgramScene", {
			sceneName: "Game",
		});
		await new Promise<void>((resolve) => {
			client.once("SceneTransitionEnded", () => resolve());
		});
		await client.call("SetSceneItemEnabled", {
			sceneName: this.source.sceneName,
			sceneItemEnabled: false,
			sceneItemId: this.source.sceneItemId,
		});
	}
}
