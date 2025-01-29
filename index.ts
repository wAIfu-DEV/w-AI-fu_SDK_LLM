import WebSocket from "ws";
import { WebSocketServer } from "ws";
import { HandleReceivedMessage } from "./src/receive_handler";

async function Main(): Promise<void>
{
    console.log("[LOG] w-AI-fu SDK LLM Module running.");

    const firstArg = process.argv[2];
    const port = Number(firstArg);

    if (Number.isNaN(port))
    {
        console.error("[ERROR] Invalid first argument:", firstArg);
        console.error("[ERROR] First argument should be a valid port number.");
        process.exit(1);
    }

    const server = new WebSocketServer({
        host: "127.0.0.1",
        port,
    });

    console.log("[LOG] Started connection on port:", port);

    server.on("error", (error: Error) => {
        console.error("[ERROR] Socket server error:", error.message);
        console.error("[ERROR] Full error:", error);
    });

    server.on("close", () => {
        console.warn("[WARN] Socket server closed.");
        process.exit(1);
    });

    server.on("connection", (socket: WebSocket, _) => {

        console.log("[LOG] Socket connected to server.");

        socket.onerror = (ev: WebSocket.ErrorEvent) => {
            console.error("[ERROR] Socket error:", ev.type);
            console.error("[ERROR] Error message:", ev.message);
            console.error("[ERROR] Full error:", ev);
        };

        socket.onclose = (ev: WebSocket.CloseEvent) => {
            console.warn("[WARN] Socket closed:", ev.code);
            console.warn("[WARN] Close reason:", ev.reason);
        };

        socket.onmessage = (ev: WebSocket.MessageEvent) => {
            HandleReceivedMessage(socket, ev.data.toString("utf8"));
        };
    });
}

setImmediate(Main);