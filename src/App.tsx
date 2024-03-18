import { useMemo, useRef, useState } from "react";
import { client } from "./lib/obs";
import { useAtom } from "jotai";
import { connectionStatusAtom } from "./lib/atom/connection-status";
import {
	Box,
	Button,
	Code,
	FormControl,
	FormHelperText,
	FormLabel,
	Grid,
	GridItem,
	Input,
	InputGroup,
	InputLeftAddon,
	InputRightAddon,
	InputRightElement,
	ListItem,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Stack,
	Text,
	UnorderedList,
	useToast,
} from "@chakra-ui/react";
import { atomWithStorage } from "jotai/utils";
import { IconCast, IconRepeat } from "@tabler/icons-react";
import Webcam from "react-webcam";
import { SourcePicker } from "./components/SourcePicker";
import { consola } from "consola/browser";
import { Recorder } from "./components/Recorder";
import type { Lap, PlayQueueItem } from "./replay.types";
import { Replayer } from "./components/Replayer";
import { VLCSourceAdapter } from "./lib/adapter/vlc-source";
import ReactPlayer from "react-player";
import { parseMsTohhmmssSSS } from "./lib/time";

const logger = consola.withTag("app");
logger.level = 5;

type Replay = {
	path: string;
	laps: Lap[];
};

const replaysAtom = atomWithStorage<Replay[]>("replays", []);

const App = () => {
	const [isConnected] = useAtom(connectionStatusAtom);
	const [host, setHost] = useState("localhost:4455");
	const [password, setPassword] = useState("");
	const [replayBufferMaxLength, setReplayBufferMaxLength] = useState(300);
	const [replayTargetSource, setReplayTargetSource] = useState<{
		sceneItemId: number;
		sceneName: string;
		itemName: string;
	} | null>(null);

	const toast = useToast();

	// Modals
	const [isOpenOBSConfigModal, setIsOpenOBSConfigModal] = useState(false);
	const [isOpenReplayConfigModal, setIsOpenReplayConfigModal] = useState(false);
	const [isOpenReplaySrcPickerModal, setIsOpenReplaySrcPickerModal] =
		useState(false);

	const [savedReplays, setSavedReplays] = useAtom(replaysAtom);

	const onConnectButton = async () => {
		await client.connect(`ws://${host}`, password);
	};

	const onClickSetReplayButton = async (replay: Replay) => {
		setPlayQueue(
			replay.laps.map((lap) => ({
				name: "(unused)",
				path: replay.path,
				startMs: lap.timeMs - lap.durationMs,
				durationMs: lap.durationMs,
			})),
		);
	};

	const [playQueue, setPlayQueue] = useState<PlayQueueItem[]>([]);
	const playerRef = useRef<ReactPlayer>(null);

	return (
		<>
			<Box display="flex" padding={3}>
				<Box display="flex" gap={3} marginLeft="auto" alignItems="center">
					<Text>{isConnected ? "接続中 🟢" : "未接続 🔴"}</Text>
					<Button
						colorScheme="teal"
						variant={isConnected ? "ghost" : "solid"}
						onClick={onConnectButton}
					>
						{isConnected ? "再接続" : "接続する"}
					</Button>
					<Button
						leftIcon={<IconCast />}
						onClick={() => setIsOpenOBSConfigModal(true)}
					>
						接続設定
					</Button>
					<Button
						leftIcon={<IconRepeat />}
						onClick={() => setIsOpenReplayConfigModal(true)}
					>
						リプレイ設定
					</Button>
				</Box>
			</Box>
			<Box px={6} py={2}>
				<Grid templateColumns="repeat(2, 1fr)" gap={6}>
					<GridItem>
						<Stack gap={4}>
							<Box>
								<Text textAlign="center" mb={2} fontWeight="bold">
									リプレイ
								</Text>
								<Box
									py={3}
									width="100%"
									display="flex"
									bgColor="gray.200"
									borderRadius={8}
									aspectRatio="16/9"
									justifyContent="center"
								>
									<ReactPlayer ref={playerRef} />
								</Box>
							</Box>
							<Replayer
								playQueue={playQueue}
								programAdapter={
									replayTargetSource
										? new VLCSourceAdapter(
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
										  )
										: null
								}
								previewAdapter={null}
								config={{}}
							/>
						</Stack>
					</GridItem>
					<GridItem>
						<Stack gap={4}>
							<Box>
								<Text textAlign="center" mb={2} fontWeight="bold">
									プログラム
								</Text>
								<Box
									py={3}
									width="100%"
									display="flex"
									bgColor="gray.200"
									borderRadius={8}
									aspectRatio="16/9"
									justifyContent="center"
								>
									<Webcam audio={false} id="obs-screen" />
								</Box>
							</Box>
							<Recorder
								client={client}
								config={{
									autoSave: true,
									maxReplaySeconds: replayBufferMaxLength,
								}}
								onRecorded={async (replay) => {
									setSavedReplays((v) => [...v, replay]);
									toast({
										title: "リプレイが保存されました",
										description: replay.path,
										status: "success",
										duration: 3000,
										isClosable: true,
									});
								}}
							/>
						</Stack>
					</GridItem>
				</Grid>
			</Box>
			<div>
				<h2>リプレイ</h2>
				<UnorderedList>
					{savedReplays.map((replay) => (
						<ListItem key={replay.path}>
							{replay.path}{" "}
							<Button
								onClick={() => onClickSetReplayButton(replay)}
								isDisabled={replayTargetSource === null}
							>
								{replayTargetSource ? "セットする" : "ソース未選択"}
							</Button>
							<Button
								onClick={() =>
									setSavedReplays((_replays) =>
										_replays.filter((_replay) => _replay.path !== replay.path),
									)
								}
							>
								リストから削除
							</Button>
							<UnorderedList>
								{replay.laps.map((lap) => (
									<ListItem key={lap.timeMs}>
										{parseMsTohhmmssSSS(lap.timeMs - lap.durationMs)} ～{" "}
										{parseMsTohhmmssSSS(lap.timeMs)}
									</ListItem>
								))}
							</UnorderedList>
						</ListItem>
					))}
				</UnorderedList>
			</div>
			<Modal
				isOpen={isOpenOBSConfigModal}
				onClose={() => setIsOpenOBSConfigModal(false)}
				closeOnOverlayClick={false}
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						<Box display="flex" alignItems="center" gap={2}>
							<IconCast display="inline-block" />
							<Text>OBS 接続設定</Text>
						</Box>
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody pb={6} display="flex" flexDirection="column" gap={6}>
						<Text fontSize="sm">
							接続後に設定を変更した場合は再接続を行ってください
						</Text>
						<FormControl>
							<FormLabel>WebSocket IP/ポート</FormLabel>
							<InputGroup>
								<InputLeftAddon>ws://</InputLeftAddon>
								<Input
									type="text"
									onInput={(e) => setHost(e.currentTarget.value)}
									value={host}
									placeholder="localhost:4455"
								/>
							</InputGroup>
							<FormHelperText>
								<Code>ツール/WebSocketサーバー設定</Code> に表示されたIPとポート
							</FormHelperText>
						</FormControl>
						<FormControl>
							<FormLabel>WebSocket パスワード</FormLabel>
							<Input
								type="password"
								onInput={(e) => setPassword(e.currentTarget.value)}
								value={password}
								placeholder="password"
							/>
							<FormHelperText>
								<Code>ツール/WebSocketサーバー設定</Code> に表示されたパスワード
							</FormHelperText>
						</FormControl>
					</ModalBody>
				</ModalContent>
			</Modal>
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
							<IconRepeat display="inline-block" />
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
									onInput={(e) =>
										setReplayBufferMaxLength(e.currentTarget.valueAsNumber)
									}
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
							<FormHelperText>リプレイに使用する VLC ソース</FormHelperText>
						</FormControl>
						<FormControl>
							<FormLabel>最大リプレイ時間</FormLabel>
							<InputGroup>
								<Input
									type="number"
									onInput={(e) =>
										setReplayBufferMaxLength(e.currentTarget.valueAsNumber)
									}
									value={replayBufferMaxLength}
									placeholder="30"
								/>
								<InputRightAddon>秒</InputRightAddon>
							</InputGroup>
							<FormHelperText>
								OBS 設定の <Code>出力/リプレイバッファ</Code> で設定した秒数
							</FormHelperText>
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

export default App;
