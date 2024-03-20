import useTimer from "easytimer-react-hook";
import consola from "consola";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayQueueItem } from "../replay.types";
import {
	Box,
	Button,
	FormControl,
	FormHelperText,
	FormLabel,
	Heading,
	Icon,
	Input,
	InputGroup,
	InputRightElement,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Stack,
	Table,
	TableContainer,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
} from "@chakra-ui/react";
import { IconChevronsRight, IconSettingsAutomation } from "@tabler/icons-react";
import { parseMsTohhmmssSSS } from "../lib/time";
import { SourcePicker } from "./SourcePicker";
import { VLCSourceAdapter } from "../lib/adapter/vlc-source";

export type ReplayerConfig = {};

type ReplayerProps = {
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

export const Replayer = ({ playQueue, config }: ReplayerProps) => {
	const [timer] = useTimer({
		precision: "secondTenths",
		updateWhenTargetAchieved: true,
	});

	const [status, setStatus] = useState<ReplayStatus>({
		step: "NOT_READY",
	});
	const statusRef = useRef<ReplayStatus | null>(null);
	useEffect(() => {
		statusRef.current = status;
	}, [status]);

	const [isOpenReplayConfigModal, setIsOpenReplayConfigModal] = useState(false);
	const [isOpenReplaySrcPickerModal, setIsOpenReplaySrcPickerModal] =
		useState(false);
	const [replayTargetSource, setReplayTargetSource] = useState<{
		sceneItemId: number;
		sceneName: string;
		itemName: string;
	} | null>(null);

	const adapters = useMemo(
		() =>
			replayTargetSource
				? [
						new VLCSourceAdapter(
							{
								in: {
									autoTransition: true,
									playBeforeTransition: true,
									transitionPointMs: 2000,
								},
								out: {
									autoTransition: true,
									keepPlayingDuringTransition: false,
								},
							},
							replayTargetSource,
						),
				  ]
				: [],
		[replayTargetSource],
	);

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
		if (index !== 0) {
			logger.debug(`[${index}] Seek to ${item.startMs} ms`);
			await Promise.allSettled(
				adapters.map((adapter) => adapter.seek(item.startMs)),
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
		<>
			<Stack gap={4}>
				<Box display="flex" alignItems="center" gap={3}>
					<Text fontSize="lg">
						{timer
							.getTimeValues()
							.toString(["hours", "minutes", "seconds", "secondTenths"])}
					</Text>
					<Text fontSize="lg">{statusText[status.step]}</Text>
					<Button
						leftIcon={<IconSettingsAutomation />}
						ml="auto"
						onClick={() => setIsOpenReplayConfigModal(true)}
					>
						リプレイ設定
					</Button>
				</Box>
				<Box
					display="flex"
					justifyContent="space-between"
					alignItems="center"
					gap={3}
				>
					<Button
						onClick={() => prepareReplay()}
						isDisabled={
							playQueue.length < 1 ||
							status.step === "PREPARING" ||
							status.step === "STARTING" ||
							status.step === "PLAYING" ||
							status.step === "ENDING"
						}
						width="100%"
					>
						再生準備
					</Button>
					<Icon as={IconChevronsRight} boxSize={4} />
					<Button
						onClick={() => startReplay()}
						isDisabled={playQueue.length < 1 || status.step !== "READY"}
						width="100%"
					>
						再生
					</Button>
				</Box>
				<Box>
					<Heading size="xs" mb={4}>
						再生キュー
					</Heading>
					<Box p={2} borderRadius="md" borderColor="gray.300" borderWidth="1px">
						{playQueue.length < 1 ? (
							<Text ml={2}>キューは空です</Text>
						) : (
							<TableContainer>
								<Table variant="simple">
									<Thead>
										<Tr>
											<Th>ファイル名</Th>
											<Th>再生箇所</Th>
										</Tr>
									</Thead>
									<Tbody>
										{playQueue.map((item, index) => (
											<Tr key={index}>
												<Td
													overflow="hidden"
													whiteSpace="nowrap"
													textOverflow="ellipsis"
													sx={{ direction: "rtl" }}
												>
													{item.path}
												</Td>
												<Td>
													{parseMsTohhmmssSSS(item.startMs)} ~{" "}
													{parseMsTohhmmssSSS(item.startMs + item.durationMs)}
												</Td>
											</Tr>
										))}
									</Tbody>
								</Table>
							</TableContainer>
						)}
					</Box>
				</Box>
			</Stack>
			<Modal
				isOpen={isOpenReplayConfigModal}
				onClose={() => setIsOpenReplayConfigModal(false)}
				closeOnOverlayClick={false}
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						<Box display="flex" alignItems="center" gap={2}>
							<IconSettingsAutomation display="inline-block" />
							<Text>リプレイ設定</Text>
						</Box>
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody pb={6} display="flex" flexDirection="column" gap={6}>
						<FormControl>
							<FormLabel>リプレイソース</FormLabel>
							<InputGroup>
								<Input
									type="text"
									value={
										replayTargetSource
											? `${replayTargetSource.sceneName} > ${replayTargetSource.itemName}`
											: "(未選択)"
									}
									isInvalid={!replayTargetSource}
									isReadOnly
								/>
								<InputRightElement width="4.5rem">
									<Button
										size="sm"
										onClick={() => setIsOpenReplaySrcPickerModal(true)}
									>
										選択
									</Button>
								</InputRightElement>
							</InputGroup>
							<FormHelperText>リプレイに使用するソース</FormHelperText>
						</FormControl>
					</ModalBody>
				</ModalContent>
			</Modal>
			<SourcePicker
				current={replayTargetSource}
				isOpen={isOpenReplaySrcPickerModal}
				onClose={() => setIsOpenReplaySrcPickerModal(false)}
				onSubmit={(selected) => {
					setIsOpenReplaySrcPickerModal(false);
					setReplayTargetSource(selected);
				}}
				selectableKind={["vlc_source"]}
			/>
		</>
	);
};
