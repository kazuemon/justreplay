import { useAtom, useAtomValue } from "jotai";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState,
} from "react";
import {
	replayBufferStatusAtom,
	replayBufferStatusWatchAtom,
} from "../lib/atom/replay-buffer-status";
import {
	Alert,
	AlertIcon,
	Box,
	Button,
	Code,
	Input,
	ListItem,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	OrderedList,
	Tag,
	Text,
	useToast,
} from "@chakra-ui/react";
import { useMomentaryBool } from "react-use-precision-timer";
import { client } from "../lib/obs";
import { replayDirectoryHandleAtom } from "../lib/atom/replay-directory-handle";
import consola from "consola";
import { connectionStatusAtom } from "../lib/atom/connection-status";

type DirHandlePickerProps = {};

export type DirHandlePickerRef = {
	open: () => void;
	close: () => void;
};

const logger = consola.withTag("");

export const DirHandlePicker = forwardRef<
	DirHandlePickerRef,
	DirHandlePickerProps
>(function DirHandlePicker(props, ref) {
	const [isOpen, setIsOpen] = useState(false);

	useImperativeHandle(ref, () => ({
		open: () => {
			setIsOpen(true);
		},
		close: () => {
			setIsOpen(false);
		},
	}));

	const [obsRecordDirPath, setObsRecordDirPath] = useState("");

	const [replayDirectoryHandle, setReplayDirectoryHandle] = useAtom(
		replayDirectoryHandleAtom,
	);

	const connectionStatus = useAtomValue(connectionStatusAtom);

	useAtom(replayBufferStatusWatchAtom);
	const replayBufferStatus = useAtomValue(replayBufferStatusAtom);
	const isAvailableReplayBuffer = useMemo(
		() => replayBufferStatus !== "NOT_AVAILABLE",
		[replayBufferStatus],
	);

	const [copied, toggleCopied] = useMomentaryBool(false, 3000);

	const toast = useToast();

	useEffect(() => {
		if (!connectionStatus) return;
		if (!isAvailableReplayBuffer) return;
		client.call("GetRecordDirectory").then(({ recordDirectory }) => {
			setObsRecordDirPath(recordDirectory);
		});
	}, [connectionStatus, isAvailableReplayBuffer]);

	const onClickCopy = useCallback(async () => {
		if (!isAvailableReplayBuffer) return;
		if (!obsRecordDirPath) return;
		await navigator.clipboard.writeText(obsRecordDirPath);
		toggleCopied();
	}, [isAvailableReplayBuffer, obsRecordDirPath, toggleCopied]);

	const onClickOpen = useCallback(async () => {
		const dirHandle = await window.showDirectoryPicker();
		try {
			setReplayDirectoryHandle(dirHandle);
			toast({
				title: "以下の名前のフォルダをリプレイフォルダとして設定しました",
				description: dirHandle.name,
				status: "success",
				isClosable: true,
			});
		} catch (e) {
			logger.error(e);
			setReplayDirectoryHandle(null);
			toast({
				title: "フォルダの選択が中断されました",
				description: "再度選択しなおしてください",
				status: "error",
				isClosable: true,
			});
		}
	}, [setReplayDirectoryHandle, toast]);

	const onClickRevoke = useCallback(() => {
		setReplayDirectoryHandle(null);
		toast({
			title: "リプレイフォルダへのアクセス許可を取り消しました",
			description: "必要であれば再度選択しなおしてください",
			status: "info",
			isClosable: true,
		});
	}, [setReplayDirectoryHandle, toast]);

	return (
		<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} isCentered>
			<ModalOverlay />
			<ModalContent>
				{connectionStatus ? (
					isAvailableReplayBuffer ? (
						<>
							<ModalHeader>リプレイフォルダアクセス設定</ModalHeader>
							<ModalCloseButton />
							<ModalBody display="flex" flexDirection="column" gap={3}>
								<Text>
									リプレイをブラウザ画面上で再生するには、アクセス許可が必要です。
								</Text>
								<Box
									p={4}
									borderRadius="md"
									borderColor="gray.300"
									borderWidth="1px"
									display="flex"
									flexDirection="column"
									gap={2}
								>
									<Text>
										現在の許可状況:{" "}
										{replayDirectoryHandle ? (
											<Tag colorScheme="green">設定済み</Tag>
										) : (
											<Tag colorScheme="red">未許可</Tag>
										)}
									</Text>
									{replayDirectoryHandle && (
										<>
											<Text>
												フォルダ名: <Code>{replayDirectoryHandle.name}</Code>
											</Text>
											<Button colorScheme="red" onClick={onClickRevoke}>
												許可を取り消す
											</Button>
										</>
									)}
								</Box>
								<OrderedList>
									<ListItem>下の「フォルダを選ぶ」を押す</ListItem>
									<ListItem>
										出てきた画面でリプレイを保存しているフォルダに移動するか、選んでから右下の「開く」を押す
									</ListItem>
									<ListItem>
										別の画面が出てきたら「ファイルを表示する」を押す
									</ListItem>
								</OrderedList>
								<Text>
									なお、OBS
									上では以下のパスがリプレイの保存場所として設定されています。コピーして、フォルダを選ぶ画面の上部にあるアドレスバーにペーストすると便利です。
								</Text>
								<Input value={obsRecordDirPath} isReadOnly />
								<Button onClick={onClickCopy}>
									{copied ? "パスをコピーしました" : "パスをコピーする"}
								</Button>
							</ModalBody>
							<ModalFooter>
								<Button colorScheme="blue" mb={3} onClick={onClickOpen}>
									フォルダを選ぶ
								</Button>
							</ModalFooter>
						</>
					) : (
						<>
							<ModalHeader>リプレイフォルダアクセス設定</ModalHeader>
							<ModalCloseButton />
							<ModalBody>
								<Alert status="error">
									<AlertIcon />
									リプレイバッファが無効になっています。リプレイバッファを有効にしてください
								</Alert>
							</ModalBody>
							<ModalFooter>
								<Button variant="ghost" mb={3} onClick={() => setIsOpen(false)}>
									閉じる
								</Button>
							</ModalFooter>
						</>
					)
				) : (
					<>
						<ModalHeader>リプレイフォルダアクセス設定</ModalHeader>
						<ModalCloseButton />
						<ModalBody>
							<Alert status="error">
								<AlertIcon />
								先に OBS と接続してください。
							</Alert>
						</ModalBody>
						<ModalFooter>
							<Button variant="ghost" mb={3} onClick={() => setIsOpen(false)}>
								閉じる
							</Button>
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal>
	);
});
