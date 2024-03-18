import { atomEffect } from "jotai-effect";
import { connectionStatusAtom } from "./connection-status";
import { atom } from "jotai";
import { client } from "../obs";
import { type OBSEventTypes, OBSWebSocketError } from "obs-websocket-js";

export const ReplayBufferStatus = {
	NOT_CONNECTED: "NOT_CONNECTED",
	NOT_AVAILABLE: "NOT_AVAILABLE",
	FETCHING: "FETCHING",
	NOT_RECORDING: "NOT_RECORDING",
	STARTING: "STARTING",
	RECORDING: "RECORDING",
	ALREADY_STARTED: "ALREADY_STARTED",
	PROCESSING: "PROCESSING",
} as const;
export type ReplayBufferStatus =
	(typeof ReplayBufferStatus)[keyof typeof ReplayBufferStatus];

const OutputState = {
	OBS_WEBSOCKET_OUTPUT_STARTING: ReplayBufferStatus.STARTING,
	OBS_WEBSOCKET_OUTPUT_STARTED: ReplayBufferStatus.RECORDING,
	OBS_WEBSOCKET_OUTPUT_STOPPING: ReplayBufferStatus.PROCESSING,
	OBS_WEBSOCKET_OUTPUT_STOPPED: ReplayBufferStatus.NOT_RECORDING,
};

export const replayBufferStatusAtom = atom<ReplayBufferStatus>(
	ReplayBufferStatus.NOT_CONNECTED,
);

export const replayBufferStatusWatchAtom = atomEffect((get, set) => {
	if (!get(connectionStatusAtom)) {
		set(replayBufferStatusAtom, ReplayBufferStatus.NOT_CONNECTED);
	} else {
		const onChangeReplayBufferStatus = (
			e: OBSEventTypes["ReplayBufferStateChanged"],
		) => {
			const outputState = e.outputState as keyof typeof OutputState;
			set(replayBufferStatusAtom, OutputState[outputState]);
		};
		set(replayBufferStatusAtom, ReplayBufferStatus.FETCHING);
		client
			.call("GetReplayBufferStatus")
			.then((e) => {
				set(
					replayBufferStatusAtom,
					e.outputActive
						? ReplayBufferStatus.ALREADY_STARTED
						: ReplayBufferStatus.NOT_RECORDING,
				);
				client.on("ReplayBufferStateChanged", onChangeReplayBufferStatus);
			})
			.catch((e) => {
				if (e instanceof OBSWebSocketError && e.code === 604) {
					set(replayBufferStatusAtom, ReplayBufferStatus.NOT_AVAILABLE);
				}
			});
		return () => {
			client.off("ReplayBufferStateChanged", onChangeReplayBufferStatus);
		};
	}
});
