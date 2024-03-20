import { Box, Button, Text } from "@chakra-ui/react";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { replayDirectoryHandleAtom } from "../lib/atom/replay-directory-handle";
import { DirHandlePicker, type DirHandlePickerRef } from "./DirHandlePicker";
import ReactPlayer from "react-player";

type EditorProps = {};

export const Editor = (props: EditorProps) => {
	const dirHandlePickerRef = useRef<DirHandlePickerRef>(null);
	const replayDirectoryHandle = useAtomValue(replayDirectoryHandleAtom);

	const [fileBlobUrl, setFileBlobUrl] = useState("");

	const [fileUrl, setFileUrl] = useState("");

	useEffect(() => {
		(async () => {
			if (!replayDirectoryHandle || !fileUrl) return;
			const splitPath = fileUrl.split("/");
			const fileName = splitPath[splitPath.length - 1];
			const fileHandle = await replayDirectoryHandle.getFileHandle(fileName);
			const fileObj = await fileHandle.getFile();
			setFileBlobUrl(URL.createObjectURL(fileObj));
		})();
	}, [fileUrl, replayDirectoryHandle]);

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
					<ReactPlayer width="100%" height="100%" url={fileBlobUrl} />
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
