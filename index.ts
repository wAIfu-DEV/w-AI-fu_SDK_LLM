import WebSocket from "ws";
import { WebSocketServer } from "ws";

async function Main(): Promise<void>
{
    const firstArg = process.argv[1];
    const port = Number(firstArg);

    if (Number.isNaN(port))
    {
        console.error("[ERROR] Invalid first argument:", port);
        console.error("[ERROR] First argument should be a valid port number.");
        process.exit(1);
    }

    const server = new WebSocketServer({
        host: "127.0.0.1",
        port,
    });

    server.on("error", (error: Error) => {
        console.error("[ERROR] Socket server error:", error.message);
        console.error("[ERROR] Full error:", error);
    });

    server.on("close", () => {
        console.warn("[WARN] Socket server closed.");
        process.exit(1);
    });

    server.on("connection", (socket: WebSocket, _) => {

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
            console.log("[LOG] Received:", ev.data.toString());
        };
    });
}

setImmediate(Main);