import { Box } from "@chakra-ui/react";
import Webcam from "react-webcam";

export const ProgramMonitor = () => {
	return (
		<Box
			width="100%"
			display="flex"
			bgColor="gray.200"
			borderRadius="md"
			aspectRatio="16/9"
			justifyContent="center"
		>
			<Webcam audio={false} />
		</Box>
	);
};
