import type { PlaySourceAdapter } from "../lib/adapter/base";
import useTimer from "easytimer-react-hook";
import consola from "consola";
import { useMemo, useRef, useState } from "react";
import type { PlayQueueItem } from "../replay.types";
import {
	Box,
	Button,
	FormControl,
	FormLabel,
	Input,
	Stack,
	Switch,
	Text,
} from "@chakra-ui/react";

export type ReplayerConfig = {};

type ReplayerProps = {
	programAdapter: PlaySourceAdapter | null;
	previewAdapter: PlaySourceAdapter | null;
	playQueue: PlayQueueItem[];
	config: ReplayerConfig;
};

const logger = consola.withTag("replayer");
logger.level = 5;

type ReplayStatus =
	| {
			step: "NOT_READY";
	  }
	| {
			step: "PREPARING";
	  }
	| {
			step: "READY";
	  }
	| {
			step: "STARTING";
	  }
	| {
			step: "PLAYING";
			index: number;
	  }
	| {
			step: "ENDING";
	  };

const statusText: Record<ReplayStatus["step"], string> = {
	NOT_READY: "未準備",
	PREPARING: "準備処理中",
	READY: "再生準備完了",
	STARTING: "開始処理中",
	PLAYING: "再生中",
	ENDING: "終了処理中",
};

export const Replayer = ({
	programAdapter,
	previewAdapter,
	playQueue,
	config,
}: ReplayerProps) => {
	const [timer] = useTimer({
		precision: "secondTenths",
		updateWhenTargetAchieved: true,
	});

	const [status, setStatus] = useState<ReplayStatus>({
		step: "NOT_READY",
	});
	const statusRef = useRef<ReplayStatus | null>(null);
	statusRef.current = status;

	const [isPreviewMode, setIsPreviewMode] = useState(false);

	const adapters = useMemo(() => {
		const _adapters: PlaySourceAdapter[] = [];
		if (previewAdapter) _adapters.push(previewAdapter);
		if (programAdapter && !isPreviewMode) _adapters.push(programAdapter);
		return _adapters;
	}, [isPreviewMode, previewAdapter, programAdapter]);

	const prepareReplay = async () => {
		setStatus({
			step: "PREPARING",
		});
		logger.debug("Preparing replay 📺");
		if (playQueue.length < 1) {
			logger.debug("Queue is empty");
		}
		const firstItem = playQueue[0];
		await Promise.allSettled(
			adapters.map((adapter) =>
				adapter.onPrepare?.(firstItem.path, firstItem.startMs),
			),
		);
		setStatus({
			step: "READY",
		});
		logger.debug("Replay is ready 🚀");
	};

	const startReplay = async () => {
		switch (status.step) {
			case "NOT_READY":
			case "PREPARING":
				logger.error("Replay is not ready");
				return;
			case "PLAYING":
				logger.error("Replay is already playing");
				return;
			case "READY":
				// OK
				break;
		}
		setStatus({
			step: "STARTING",
		});
		logger.debug("Calling onStart 📞");
		await Promise.allSettled(adapters.map((adapter) => adapter.onStart?.()));
		timer.addEventListener("targetAchieved", onQueueItemEnded);
		logger.debug("Start replay 🎬");
		await playItem(0);
	};

	const onQueueItemEnded = async () => {
		const _status = statusRef.current;
		if (!_status || _status.step !== "PLAYING") return;
		logger.debug(`[${_status.index}] End!`);
		if (_status.index === playQueue.length - 1) {
			logger.debug("Replay finish!");
			timer.removeEventListener("targetAchieved", onQueueItemEnded);
			timer.stop();
			await Promise.allSettled(adapters.map((adapter) => adapter.pause()));
			setStatus({
				step: "ENDING",
			});
			logger.debug("Calling onEnd 📞");
			await Promise.allSettled(adapters.map((adapter) => adapter.onEnd?.()));
			setStatus({
				step: "NOT_READY",
			});
			logger.debug("Finish replay 🎬");
			return;
		}
		logger.debug("Next Lap ⏩", _status.index + 1);
		await playItem(_status.index + 1);
	};

	const playItem = async (index: number) => {
		if (playQueue.length <= index) throw new RangeError();

		const item = playQueue[index];
		const startMs = item.startMs * 100;
		if (index !== 0) {
			logger.debug(`[${index}] Seek to ${startMs} ms`);
			await Promise.allSettled(
				adapters.map((adapter) => adapter.seek(startMs)),
			);
		}
		logger.debug(`[${index}] Play!`);
		await Promise.allSettled(adapters.map((adapter) => adapter.resume()));

		timer.start({
			startValues: {
				secondTenths: item.startMs / 100,
			},
			target: {
				secondTenths: item.startMs / 100 + item.durationMs / 100,
			},
		});

		setStatus({
			step: "PLAYING",
			index: index,
		});
	};

	return (
		<Stack gap={4}>
			<Input
				variant="flushed"
				placeholder="Empty Queue"
				value={
					status.step === "PLAYING"
						? playQueue[status.index].name
						: playQueue[0] !== undefined
						  ? playQueue[0].name
						  : ""
				}
				isReadOnly
			/>
			<Box display="flex" alignItems="center" gap={3}>
				<Text fontSize="lg">
					{timer
						.getTimeValues()
						.toString(["hours", "minutes", "seconds", "secondTenths"])}
				</Text>
				<Text fontSize="lg">{statusText[status.step]}</Text>
			</Box>
			<FormControl display="flex" alignItems="center">
				<FormLabel htmlFor="preview-mode-switch" mb="0">
					プレビューモード
				</FormLabel>
				<Switch
					id="preview-mode-switch"
					checked={isPreviewMode}
					onChange={(e) => setIsPreviewMode(e.currentTarget.checked)}
				/>
			</FormControl>
			<Button
				onClick={() => startReplay()}
				isDisabled={playQueue.length < 1 || status.step !== "READY"}
			>
				再生
			</Button>
			<Button onClick={() => prepareReplay()} isDisabled={playQueue.length < 1}>
				再生準備
			</Button>
		</Stack>
	);
};
