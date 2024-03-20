import { Box, Heading } from "@chakra-ui/react";

type UIWindowProps = {
	title: string;
	children?: JSX.Element;
};

export const UIWindow = ({ title, children }: UIWindowProps) => {
	return (
		<Box borderRadius="md" borderColor="gray.300" borderWidth="1px">
			<Box bgColor="gray.200" py={2} px={4}>
				<Heading size="xs">{title}</Heading>
			</Box>
			<Box p={4}>{children}</Box>
		</Box>
	);
};
