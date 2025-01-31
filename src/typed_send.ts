import WebSocket from "ws";
import { MessageOutType, StrictMessageData } from "./types";

export function sendToClient<K extends MessageOutType>(socket: WebSocket, messageType: K, data: StrictMessageData<K>): void
{
    if (data.type !== messageType) {
        throw new Error(`Message type mismatch: expected ${messageType}, got ${data.type}`);
    }
    socket.send(JSON.stringify(data));
}