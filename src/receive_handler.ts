import * as fs from "fs/promises";
import * as path from "path";

import WebSocket from "ws";
import { state } from "./global_state";
import { LoadProvider } from "./load_provider";
import { HandleGenerateRequest } from "./handle_generate";
import { LLM_GEN_ERR } from "./types";

export enum ReceiveTypeEnum {
    LOAD = "load",
    GENERATE = "generate",
    INTERRUPT = "interrupt",
    CLOSE = "close",
    GET_PROVIDERS = "get_providers",
    GET_MODELS = "get_models"
};

type ReceiveType =`${ReceiveTypeEnum}`;

export type IncomingMessage = {
    type: ReceiveType,
    unique_request_id: string
}

type LoadMessage = {
    type: "load",
    unique_request_id: string,
    provider: string
}

export async function HandleReceivedMessage(socket: WebSocket , messageStr: string): Promise<void>
{
    try
    {
        var message: unknown = JSON.parse(messageStr);
    }
    catch
    {
        console.error("[ERROR] Failed to parse incoming message as JSON.");
        console.error("[ERROR] Refer to the README file for more information about valid messages.");
        return;
    }

    if (!message)
    {
        console.error("[ERROR] Parsed message is null or undefined.");
        console.error("[ERROR] Refer to the README file for more information about valid messages.");
        return;
    }

    if (typeof message != "object")
    {
        console.error("[ERROR] Parsed message is not of type object.");
        console.error("[ERROR] Refer to the README file for more information about valid messages.");
        return;
    }

    let obj = {
        ...message
    };

    if (obj["api_key"] != undefined)
    {
        obj["api_key"] = "hidden";
    }

    console.log("[LOG] Received:", obj);

    if (message["type"] == undefined)
    {
        console.error("[ERROR] Incoming message does not have the required field \"type\".");
        console.error("[ERROR] Valid types are:", Object.values(ReceiveTypeEnum).join(", "));
        console.error("[ERROR] Refer to the README file for more information about each type.");
        return;
    }

    if (message["unique_request_id"] == undefined)
    {
        console.error("[ERROR] Incoming message does not have the required field \"unique_request_id\".");
        console.error("[ERROR] The client application must generate a unique string in order to differentiate responses from server.");
        console.error("[ERROR] Refer to the README file for more information about messages");
        return;
    }

    let incomingMessage: IncomingMessage = message as IncomingMessage;

    switch (incomingMessage.type)
    {
        case ReceiveTypeEnum.LOAD: {
            console.warn("[LOG] Received load message.");

            if (incomingMessage["provider"] == undefined)
            {
                console.error("[ERROR] Incoming load message does not have the required field \"provider\".");
                console.error("[ERROR] Example:", { type: "load", unique_request_id: "<id>", provider: "openai" });
                console.error("[ERROR] Refer to the README file for more information about load messages.");
                return;
            }

            let loadMessage: LoadMessage = incomingMessage as LoadMessage;

            socket.send(JSON.stringify({
                type: "load_ack",
                unique_request_id: loadMessage.unique_request_id,
                provider: loadMessage.provider
            }));

            let error = await LoadProvider(loadMessage.provider, loadMessage);

            let isError = error != LLM_GEN_ERR.SUCCESS;
            if (isError)
            {
                state.loadedProviderName = undefined;
                state.largeLanguageModel = undefined;
            }
            else
            {
                console.log("[LOG] Successfully loaded provider:", loadMessage.provider);
                state.loadedProviderName = loadMessage.provider;
            }

            socket.send(JSON.stringify({
                type: "load_done",
                unique_request_id: loadMessage.unique_request_id,
                provider: loadMessage.provider,
                is_error: isError,
                error
            }));
            return;
        }
        case ReceiveTypeEnum.CLOSE: {
            console.warn("[LOG] Received close message.");

            socket.send(JSON.stringify({
                type: "close_ack",
                unique_request_id: incomingMessage.unique_request_id
            }));

            process.exit(0);
            return;
        }
        case ReceiveTypeEnum.INTERRUPT: {
            console.warn("[LOG] Received interrupt message.");

            socket.send(JSON.stringify({
                type: "interrupt_ack",
                unique_request_id: incomingMessage.unique_request_id
            }));
            
            if (state.largeLanguageModel == undefined)
            {
                console.error("[ERROR] Cannot interrupt, no provider is currently loaded.");
                return;
            }
            
            await state.largeLanguageModel.Interrupt();
            return;
        }
        case ReceiveTypeEnum.GENERATE: {
            console.warn("[LOG] Received generate message.");
            await HandleGenerateRequest(socket, incomingMessage);
            return;
        }
        case ReceiveTypeEnum.GET_PROVIDERS: {
            console.warn("[LOG] Received \"get providers\" message.");
            let providers = await fs.readdir(path.join(process.cwd(), "providers"));
            socket.send(JSON.stringify({
                type: "get_providers_done",
                unique_request_id: incomingMessage.unique_request_id,
                providers
            }));
            return;
        }
        case ReceiveTypeEnum.GET_MODELS: {
            console.warn("[LOG] Received \"get models\" message.");
            let models: string[] = [];

            if (state.largeLanguageModel == undefined)
            {
                console.error("[ERROR] Cannot get models, no provider is currently loaded.");
            }
            else
            {
                models = await state.largeLanguageModel.GetModels();
            }

            socket.send(JSON.stringify({
                type: "get_models_done",
                unique_request_id: incomingMessage.unique_request_id,
                models
            }));
            return;
        }
        default: {
            console.error("[ERROR] Incoming message has invalid field \"type\":", incomingMessage.type);
            console.error("[ERROR] Valid types are:", Object.values(ReceiveTypeEnum).join(", "));
            console.error("[ERROR] Refer to the README file for more information about each type.");
            return;
        }
    }
}