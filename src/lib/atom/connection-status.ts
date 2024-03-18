import { atom } from "jotai";
import { client } from "../obs";
import { IncomingMessageTypes, WebSocketOpCode } from "obs-websocket-js";

export const connectionStatusAtom = atom(false);

connectionStatusAtom.onMount = (set) => {
	const onIdentified = (
		e: IncomingMessageTypes[WebSocketOpCode.Identified],
	) => {
		console.debug("ConnectionStatus", "Identified");
		set(true);
	};
	const onConnectionClosed = () => {
		console.debug("ConnectionStatus", "ConnectionClosed");
		set(false);
	};

	client.on("Identified", onIdentified);
	client.on("ConnectionClosed", onConnectionClosed);

	return () => {
		client.off("Identified", onIdentified);
		client.off("ConnectionClosed", onConnectionClosed);
	};
};
