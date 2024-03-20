import { Box, Button, Text } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { useRef } from "react";
import { replayDirectoryHandleAtom } from "../lib/atom/replay-directory-handle";
import { DirHandlePicker, type DirHandlePickerRef } from "./DirHandlePicker";

type EditorProps = {};

export const Editor = (props: EditorProps) => {
	const dirHandlePickerRef = useRef<DirHandlePickerRef>(null);
	const replayDirectoryHandle = useAtomValue(replayDirectoryHandleAtom);

	return (
		<>
			<Box
				width="100%"
				display="flex"
				bgColor="gray.200"
				borderRadius="md"
				aspectRatio="16/9"
				alignItems="center"
				justifyContent="center"
				flexDirection="column"
				gap={4}
			>
				{replayDirectoryHandle ? (
					<Text>未実装</Text>
				) : (
					<>
						<Text textAlign="center">
							リプレイプレビューの表示には
							<br />
							アクセス許可が必要です
						</Text>
						<Button
							colorScheme="teal"
							onClick={() => dirHandlePickerRef.current?.open()}
						>
							アクセス許可設定
						</Button>
					</>
				)}
			</Box>
			<DirHandlePicker ref={dirHandlePickerRef} />
		</>
	);
};
