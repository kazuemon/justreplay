import consola from "consola";
import type { Lap, Replay } from "../replay.types";
import type OBSWebSocket from "obs-websocket-js";
import type { OBSEventTypes } from "obs-websocket-js";
import { useAtom, useAtomValue } from "jotai";
import {
	replayBufferStatusWatchAtom,
	replayBufferStatusAtom,
	ReplayBufferStatus,
} from "../lib/atom/replay-buffer-status";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Stack,
	Button,
	Alert,
	AlertIcon,
	Box,
	Text,
	Tag,
	Input,
} from "@chakra-ui/react";
import {
	IconPlayerStopFilled,
	IconPlayerRecordFilled,
	IconFlag,
	IconCut,
} from "@tabler/icons-react";
import { Temporal } from "temporal-polyfill";
import { PeriodicRender } from "./PeriodicRender";
import { parseMsTohhmmssSSS } from "../lib/time";
import { Subs, Subscribe, type Unsubscribe } from "react-sub-unsub";

const logger = consola.withTag("recorder");
logger.level = 5;

export type RecorderConfig = {
	maxReplaySeconds: number;
	autoSave: boolean;
};

type LapMode = "OVERLAP" | "MERGE" | "SHORTEN" | "SHIFT_BACK";

type RecorderProps = {
	client: OBSWebSocket;
	config: RecorderConfig;
	onRecorded?: (replay: Replay) => Promise<void>;
};

// To be configurable
const DURATION_MS = 3000;
const LIMIT_MARGIN_MS = 5000;

export const Recorder = ({ client, config, onRecorded }: RecorderProps) => {
	useAtom(replayBufferStatusWatchAtom);
	const replayBufferStatus = useAtomValue(replayBufferStatusAtom);

	const [replayName, setReplayName] = useState("");

	const [laps, setLaps] = useState<Lap[]>([]);
	const [unsavedLaps, setUnsavedLaps] = useState<Lap[] | null>(null);

	// Stopwatch
	const subsRef = useRef(new Subs());
	const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
	const [firstLapAt, setFirstLapAt] = useState<number | null>(null);
	const [limitCheckTickUnsubFunc, setLimitCheckTickUnsubFunc] =
		useState<Unsubscribe | null>(null);

	useEffect(() => {
		return () => {
			console.log("cleanup");
			subsRef.current.unsubAll();
		};
	}, []);

	const [recordLimitMs, setRecordLimitMs] = useState<number | null>(null);

	const firstLapAtRef = useRef<number | null>(null);
	useEffect(() => {
		firstLapAtRef.current = firstLapAt;
	}, [firstLapAt]);

	const startLimitCheckTimer = async (limitMs: number) => {
		if (recordStartedAt === null) {
			logger.error("timer not started");
			return;
		}
		const now = Date.now();
		if (limitMs < now) {
			logger.error("limitMs must be before current time");
			return;
		}
		setFirstLapAt(now);
		const unsub = Subscribe.setInterval(() => {
			if (firstLapAtRef.current === null) return;
			if (
				firstLapAtRef.current + config.maxReplaySeconds * 1000 - Date.now() <=
				LIMIT_MARGIN_MS
			) {
				logger.info("force save triggered");
				onClickSaveButton();
			}
		}, 100);
		setLimitCheckTickUnsubFunc(() => unsub);
	};

	const onClickToggleReplayBuffer = async () => {
		await client.call("ToggleReplayBuffer");
	};

	const onClickLapButton = async () => {
		if (!recordStartedAt) return;
		const now = Date.now();
		const timeMs = now - recordStartedAt;
		if (laps.length === 0) {
			startLimitCheckTimer(now + config.maxReplaySeconds * 1000);
		}
		setLaps((v) => [
			...v,
			{
				timeMs,
				durationMs: DURATION_MS,
			},
		]);
	};

	const onClickSaveButton = async () => {
		if (unsavedLaps !== null) {
			logger.warn("There is an unsaved laps", unsavedLaps);
		}
		setFirstLapAt(Date.now());
		setRecordLimitMs(null);
		setUnsavedLaps(laps);
		setLaps([]);
		await client.call("SaveReplayBuffer");
	};

	const onSavedReplay = async (e: OBSEventTypes["ReplayBufferSaved"]) => {
		if (unsavedLaps === null) {
			logger.warn("Unsaved laps not found");
			return;
		}
		if (onRecorded)
			await onRecorded({
				path: e.savedReplayPath,
				laps: unsavedLaps,
			});
		setUnsavedLaps(null);
	};

	useEffect(() => {
		client.on("ReplayBufferSaved", onSavedReplay);
		return () => {
			client.off("ReplayBufferSaved", onSavedReplay);
		};
	}, [client, onSavedReplay]);

	useEffect(() => {
		if (replayBufferStatus === ReplayBufferStatus.RECORDING) {
			setRecordStartedAt(Date.now());
		} else {
			setRecordStartedAt(null);
			setLaps([]);
			setFirstLapAt(null);
			limitCheckTickUnsubFunc?.();
		}
	}, [replayBufferStatus, limitCheckTickUnsubFunc]);

	return (
		<Stack gap={4}>
			<Input
				variant="flushed"
				placeholder="Replay Name"
				value={replayName}
				onChange={(e) => setReplayName(e.currentTarget.value)}
			/>
			<Box display="flex" alignItems="center" gap={3}>
				<Button
					colorScheme={
						replayBufferStatus === ReplayBufferStatus.RECORDING
							? "red"
							: replayBufferStatus === ReplayBufferStatus.ALREADY_STARTED
							  ? "yellow"
							  : "gray"
					}
					onClick={onClickToggleReplayBuffer}
					isDisabled={
						replayBufferStatus !== ReplayBufferStatus.NOT_RECORDING &&
						replayBufferStatus !== ReplayBufferStatus.RECORDING &&
						replayBufferStatus !== ReplayBufferStatus.ALREADY_STARTED
					}
				>
					{replayBufferStatus === ReplayBufferStatus.RECORDING ||
					replayBufferStatus === ReplayBufferStatus.ALREADY_STARTED ? (
						<IconPlayerStopFilled />
					) : (
						<IconPlayerRecordFilled />
					)}
				</Button>
				{firstLapAt ? (
					<PeriodicRender
						render={() => {
							const lastMs =
								firstLapAt +
								config.maxReplaySeconds * 1000 -
								LIMIT_MARGIN_MS -
								Date.now();
							return (
								<Text fontSize="lg" color={lastMs < 10000 ? "red" : undefined}>
									{`-${parseMsTohhmmssSSS(lastMs)}`}
								</Text>
							);
						}}
						renderRateMs={50}
					/>
				) : null}
				{config.autoSave ? (
					<Tag colorScheme="teal">-10s AutoSave</Tag>
				) : (
					<Tag>No AutoSave</Tag>
				)}
				<Button
					ml="auto"
					onClick={onClickLapButton}
					isDisabled={replayBufferStatus !== ReplayBufferStatus.RECORDING}
					colorScheme="teal"
				>
					<IconFlag />
				</Button>
				<Button
					onClick={onClickSaveButton}
					isDisabled={
						replayBufferStatus !== ReplayBufferStatus.RECORDING || !!unsavedLaps
					}
					colorScheme="teal"
				>
					<IconCut />
				</Button>
			</Box>
			{replayBufferStatus === ReplayBufferStatus.ALREADY_STARTED && (
				<Alert status="error">
					<AlertIcon />
					一旦リプレイバッファを再起動する必要があります
				</Alert>
			)}
		</Stack>
	);
};
