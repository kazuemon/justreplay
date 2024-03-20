import { useState } from "react";
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
import { IconCast } from "@tabler/icons-react";
import { consola } from "consola/browser";
import { Recorder } from "./components/Recorder";
import type { Lap, PlayQueueItem } from "./replay.types";
import { Replayer } from "./components/Replayer";
import { parseMsTohhmmssSSS } from "./lib/time";
import { UIWindow } from "./components/UIWindow";
import { ProgramMonitor } from "./components/ProgramMonitor";
import { Editor } from "./components/Editor";
import { OBSWebSocketError } from "obs-websocket-js";

const logger = consola.withTag("app");
logger.level = 5;

type Replay = {
	path: string;
	laps: Lap[];
};

const replaysAtom = atomWithStorage<Replay[]>("replays", []);

const App = () => {
	const toast = useToast();

	const [isConnected] = useAtom(connectionStatusAtom);

	const [isOpenOBSConfigModal, setIsOpenOBSConfigModal] = useState(false);
	const [host, setHost] = useState("localhost:4455");
	const [password, setPassword] = useState("");
	const [replayBufferMaxLength, setReplayBufferMaxLength] = useState(300);

	const [savedReplays, setSavedReplays] = useAtom(replaysAtom);
	const [playQueue, setPlayQueue] = useState<PlayQueueItem[]>([]);

	const onConnectButton = async () => {
		try {
			await client.connect(`ws://${host}`, password);
			toast({
				title: "OBS との接続が完了しました",
				status: "success",
				isClosable: true,
			});
		} catch (e) {
			if (e instanceof OBSWebSocketError) {
				let errorReason = "";
				switch (e.code) {
					case 4009:
						if (e.message === "Authentication failed.") {
							errorReason = "認証情報が正しくありません";
						} else if (
							e.message ===
							"Your payload's data is missing an `authentication` string, however authentication is required."
						) {
							errorReason = "認証情報が入力されていない可能性があります";
						} else {
							errorReason = "認証に失敗しました";
						}
						break;
				}
				toast({
					title: "接続に失敗しました",
					description: errorReason,
					status: "error",
					isClosable: true,
				});
				logger.error("ConnectError", e.code, e.message);
			} else {
				toast({
					title: "接続に失敗しました",
					description: "不明なエラーです。コンソールを確認してください。",
					status: "error",
				});
				logger.error("ConnectError", "UnknownError", e);
			}
		}
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

	return (
		<>
			<Box display="flex" p={3}>
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
				</Box>
			</Box>
			<Box px={3} py={2}>
				<Grid templateColumns="repeat(2, minmax(0, 1fr))" gap={4}>
					<GridItem>
						<Stack gap={4}>
							<UIWindow title="リプレイリスト">
								<UnorderedList>
									{savedReplays.map((replay) => (
										<ListItem key={replay.path}>
											{replay.path}{" "}
											<Button onClick={() => onClickSetReplayButton(replay)}>
												セットする
											</Button>
											<Button
												onClick={() =>
													setSavedReplays((_replays) =>
														_replays.filter(
															(_replay) => _replay.path !== replay.path,
														),
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
							</UIWindow>
							<UIWindow title="エディター">
								<Editor />
							</UIWindow>
						</Stack>
					</GridItem>
					<GridItem>
						<Stack gap={4}>
							<UIWindow title="プログラムモニター">
								<ProgramMonitor />
							</UIWindow>
							<UIWindow title="レコーダー">
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
							</UIWindow>
							<UIWindow title="リプレイヤー">
								<Replayer playQueue={playQueue} config={{}} />
							</UIWindow>
						</Stack>
					</GridItem>
				</Grid>
			</Box>
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
							<Text>OBS 設定</Text>
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
		</>
	);
};

export default App;
