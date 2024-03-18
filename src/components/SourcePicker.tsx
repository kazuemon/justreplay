import {
	Text,
	Box,
	Button,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	UnorderedList,
	ListItem,
	AlertDialog,
	AlertDialogBody,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	Alert,
	AlertIcon,
} from "@chakra-ui/react";
import { IconDeviceProjector } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { scenesWatchAtom, scenesAtom } from "../lib/atom/scenes";
import { connectionStatusAtom } from "../lib/atom/connection-status";

type SceneItemPair = {
	sceneName: string;
	itemName: string;
	sceneItemId: number;
};

type Props = {
	isOpen: boolean;
	current: SceneItemPair | null;
	onSubmit: (selected: SceneItemPair) => void;
	onClose: () => void;
	selectableKind: string[];
};

export const SourcePicker = (props: Props) => {
	const [isConnected] = useAtom(connectionStatusAtom);

	useAtom(scenesWatchAtom);
	const [scenes] = useAtom(scenesAtom);

	const [selected, setSelected] = useState(props.current);

	const [isCheckingDiscard, setIsCheckingDiscard] = useState(false);
	const cancelRef = useRef(null);

	useEffect(() => {
		if (props.isOpen) {
			setSelected(props.current);
		}
	}, [props.isOpen, props.current]);

	const _onClose = () => {
		// itemName is unique in OBS
		if (!isCheckingDiscard && props.current?.itemName !== selected?.itemName) {
			setIsCheckingDiscard(true);
			return;
		}
		props.onClose();
	};

	return (
		<>
			<Modal
				isOpen={props.isOpen}
				onClose={_onClose}
				closeOnOverlayClick={false}
				scrollBehavior="inside"
				size="lg"
				isCentered
			>
				<ModalOverlay />
				<ModalContent>
					<ModalHeader>
						<Box display="flex" alignItems="center" gap={2}>
							<IconDeviceProjector />
							<Text>ソース選択</Text>
						</Box>
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody>
						{(!isConnected && scenes.length) === 0 && (
							<Alert status="warning">
								<AlertIcon />
								先に OBS と接続してください
							</Alert>
						)}
						<UnorderedList>
							{scenes.map((scene) => (
								<ListItem key={scene.name}>
									{scene.name}
									<UnorderedList>
										{scene.items.map((item) => (
											<ListItem key={item.sceneItemId}>
												{item.isGroup ? (
													<>グループ(未対応)</>
												) : (
													<>
														{item.sourceName} / {item.inputKind}
														<Button
															onClick={() =>
																setSelected({
																	sceneName: scene.name,
																	itemName: item.sourceName,
																	sceneItemId: item.sceneItemId,
																})
															}
															isDisabled={
																!props.selectableKind.includes(item.inputKind)
															}
															colorScheme={
																selected?.itemName === item.sourceName
																	? "green"
																	: undefined
															}
														>
															{!props.selectableKind.includes(item.inputKind)
																? "未対応"
																: selected?.itemName === item.sourceName
																  ? "選択中"
																  : "選択する"}
														</Button>
													</>
												)}
											</ListItem>
										))}
									</UnorderedList>
								</ListItem>
							))}
						</UnorderedList>
					</ModalBody>
					<ModalFooter>
						<Button variant="ghost" mr={3} onClick={_onClose}>
							キャンセル
						</Button>
						<Button
							onClick={() =>
								selected ? void props.onSubmit(selected) : void 0
							}
							isDisabled={!selected}
							colorScheme="teal"
						>
							確定
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<AlertDialog
				isOpen={isCheckingDiscard}
				leastDestructiveRef={cancelRef}
				onClose={() => setIsCheckingDiscard(false)}
			>
				<AlertDialogOverlay>
					<AlertDialogContent>
						<AlertDialogHeader fontSize="lg" fontWeight="bold">
							確定されていない変更があります
						</AlertDialogHeader>
						<AlertDialogBody>
							ソース選択の変更を破棄してもよろしいですか？
						</AlertDialogBody>
						<AlertDialogFooter>
							<Button
								ref={cancelRef}
								onClick={() => setIsCheckingDiscard(false)}
							>
								戻る
							</Button>
							<Button
								colorScheme="red"
								onClick={() => {
									setIsCheckingDiscard(false);
									props.onClose();
								}}
								ml={3}
							>
								破棄して閉じる
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialogOverlay>
			</AlertDialog>
		</>
	);
};
