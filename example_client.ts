import * as readline from "readline/promises";
import { WebSocket } from "ws";

export enum LLM_GEN_ERR {
    SUCCESS = "SUCCESS",
    UNEXPECTED = "UNEXPECTED",
    AUTHORIZATION = "AUTHORIZATION",
    INVALID_PROMPT = "INVALID_PROMPT",
    INVALID_PROVIDER = "INVALID_PROVIDER",
    INVALID_MODEL = "INVALID_MODEL",
    TIMEOUT = "TIMEOUT",
    INTERRUPT = "INTERRUPT",
};

type MessageInType = "load"
                     | "generate"
                     | "interrupt"
                     | "close"
                     | "get_providers"
                     | "get_models";

export type MessageOutType = "load_ack"
                      | "generate_ack"
                      | "interrupt_ack"
                      | "close_ack"
                      | "load_done"
                      | "generate_done"
                      | "generate_streamed"
                      | "generate_stream_done"
                      | "generate_stream_chunk"
                      | "get_providers_done"
                      | "get_models_done"

let LlmProviderList = ["openai", "novelai", "groq"] as const;
type LlmProviderListType = typeof LlmProviderList & string[];
type LlmProviderName = typeof LlmProviderList[number];

type OutDataBase = {
    type: MessageOutType,
    unique_request_id: string,
}

type LoadDoneResponse = OutDataBase & {
    type: "load_done";
    provider: LlmProviderName
    is_error: boolean;
    error: LLM_GEN_ERR;
}

type GenerateDoneResponse = OutDataBase & {
    type: "generate_done"
    is_error: boolean;
    error: LLM_GEN_ERR;
    response: string;
}

type StreamChunkResponse = OutDataBase & {
    type: "generate_stream_chunk"
    chunk: string;
}

type StreamDoneResponse = OutDataBase & {
    type: "generate_stream_done"
    is_error: boolean;
    error: LLM_GEN_ERR;
}

type GetProvidersDoneResponse = OutDataBase & {
    type: "get_providers_done"
    providers: LlmProviderListType;
}

type GetModelsDoneResponse = OutDataBase & {
    type: "get_models_done"
    models: string[];
}

type LoadAcknowledgement = OutDataBase & {
    type: "load_ack",
    provider: LlmProviderName
}

type GenerateAcknowledgement = OutDataBase & {
    type: "generate_ack"
}

type InterruptAcknowledgement = OutDataBase & {
    type: "interrupt_ack"
}

type CloseAcknowledgement = OutDataBase & {
    type: "close_ack"
}

type MessageTypeMap =  {
    load_ack: LoadAcknowledgement;
    generate_ack: GenerateAcknowledgement;
    interrupt_ack: InterruptAcknowledgement;
    close_ack: CloseAcknowledgement;
    load_done: LoadDoneResponse;
    generate_done: GenerateDoneResponse;
    generate_streamed: GenerateDoneResponse;
    generate_stream_chunk: StreamChunkResponse;
    generate_stream_done: StreamDoneResponse;
    get_providers_done: GetProvidersDoneResponse;
    get_models_done: GetModelsDoneResponse;
}

type TaggedPromise<T> = {
    promise: Promise<T>,
    resolve: (arg0: T) => any,
    id: string
}

type LlmMessage = {
    role: "function" | "tool" | "system" | "user" | "assistant";
    content: string;
    name?: string | undefined
}

// Enforces a length of > 0
type LlmMessages = [LlmMessage, ...LlmMessage[]]

type LlmGenParams = {
    model_id: string;
    character_name: string;
    temperature?: number | undefined;
    max_output_length?: number | undefined;
    stop_tokens?: string[] | number[] | undefined | null;
    timeout_ms?: number | undefined | null;
}

const defaultGenParams: LlmGenParams = {
    model_id: "",
    character_name: "AI",
    temperature: 1.0,
    max_output_length: 200,
    stop_tokens: ["\r", "\n"],
    timeout_ms: 60_000,
}

type LlmProviderLoadParams = {
    api_key?: string;
    preload_model_id?: string;
}

class wAIfuLlmClient
{
    // Client socket connected to the module
    socket: WebSocket;

    // Collection of listeners for each message types
    // Allows us to await the reception of message data
    listeners: {
        [K in MessageOutType]: Record<string, TaggedPromise<MessageTypeMap[K]>>
    } = {
        load_ack: {},
        close_ack: {},
        interrupt_ack: {},
        generate_ack: {},
        load_done: {},
        generate_done: {},
        generate_stream_chunk: {},
        generate_stream_done: {},
        generate_streamed: {},
        get_models_done: {},
        get_providers_done: {}
    }

    // Promises are one-time use, so for the streaming we use a callback instead
    streamListeners: Record<string, (chunk: string) => any> = {}

    constructor()
    {
        // Connect to module
        this.socket = new WebSocket("ws://127.0.0.1:7562");
        this.socket.onmessage = this.incomingHandler.bind(this);
    }

    async sendToModule(data: any)
    {
        await this.waitForConnected();
        this.socket.send(JSON.stringify(data));
    }

    async waitForConnected(): Promise<void>
    {
        if (this.socket.readyState == WebSocket.OPEN) return;

        const CONNECT_TIMEOUT = 5_000;
        let spent_time = 0;

        while (spent_time < CONNECT_TIMEOUT)
        {
            await new Promise(r => setTimeout(r, 100));
            spent_time += 100;
            // @ts-ignore
            if (this.socket.readyState == WebSocket.OPEN) return;
        }

        throw Error("Timeout during connection to LLM module.");
    }

    emit(messageType: string, id: string, data: any): void
    {
        // Necessary edge case since promises are one-time use
        if (messageType == "generate_stream_chunk")
        {
            // If we have a callback set for a call to generate with stream:on
            // We call it for each chunk we receive.
            // Here the id ensures we are sending the data to the right callback
            let callback = this.streamListeners[id];
            if (callback != undefined) callback(data.chunk);
        }
        else
        {
            let promise: TaggedPromise<OutDataBase> | undefined = this.listeners[messageType][id];
            
            if (promise != undefined)
            {
                promise.resolve(data);
                // Remove listener after resolve
                delete this.listeners[messageType][id];
            }
            else
            {
                console.error("[ERROR] Received unhandled message from server:", data);
                console.error("[ERROR] This might be due to an out-of-date client or module.");
            }
        }
    }

    incomingHandler(ev: MessageEvent): void
    {
        let message = JSON.parse(ev.data.toString());
        let id = message.unique_request_id;
        this.emit(message.type, id, message);
    }

    listenTo<K extends MessageOutType, R = MessageTypeMap[K]>(messageType: K, id: string): Promise<R>
    {
        let resolver!: (arg0: R) => any;

        let promise = new Promise<R>(resolve => {
            resolver = resolve;
        });

        let taggedPromise = {
            id,
            resolve: resolver,
            promise
        };

        // @ts-ignore
        this.listeners[messageType][id] = taggedPromise;
        return taggedPromise.promise;
    }

    removeListener(messageType: string, id: string): void
    {
        if (this.listeners[messageType][id] != undefined)
        {
            delete this.listeners[messageType][id];
        }
    }

    removeAllListeners(id: string): void
    {
        for (let [messageType, _] of Object.entries(this.listeners))
        {
            if (this.listeners[messageType][id] != undefined)
            {
                delete this.listeners[messageType][id];
            }
        }

        if (this.streamListeners[id] != undefined)
        {
            delete this.streamListeners[id];
        }
    }

    listenToStream(id: string, callback: (chunk: string) => any): void
    {
        this.streamListeners[id] = callback;
    }

    removeStreamListener(id: string): void
    {
        if (this.streamListeners[id] != undefined)
        {
            delete this.streamListeners[id];
        }
    }

    async loadProvider(providerName: LlmProviderName, params: LlmProviderLoadParams): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("load_ack", id);
        let donePromise = this.listenTo("load_done", id);

        // Send request to module
        await this.sendToModule({
            type: "load",
            unique_request_id: id,
            provider: providerName,
            api_key: params.api_key,
            preload_model_id: params.preload_model_id
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("loadProvider timed out, LLM module may be closed.");
        }

        // Wait for response of module
        let doneMessage = await donePromise;

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to load provider. Error: " + doneMessage.error);
        }
        return;
    }

    async generate(messages: LlmMessages, params: LlmGenParams): Promise<string>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("generate_ack", id);
        let donePromise = this.listenTo("generate_done", id);

        let completeParams = {
            ...defaultGenParams,
            ...params,
        }

        // Send request to module
        await this.sendToModule({
            type: "generate",
            unique_request_id: id,
            messages,
            params: completeParams,
            stream: false
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("generate timed out, LLM module may be closed.");
        }

        // Wait for response of module
        let doneMessage = await donePromise;

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to generate response. Error: " + doneMessage.error);
        }
        return doneMessage.response;
    }

    async generateStream(messages: LlmMessages, params: LlmGenParams, callback: (chunk: string) => any): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("generate_ack", id);
        let donePromise = this.listenTo("generate_stream_done", id);
        this.listenToStream(id, callback);

        // Send request to module
        await this.sendToModule({
            type: "generate",
            unique_request_id: id,
            messages,
            params,
            stream: true
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("generateStream timed out, LLM module may be closed.");
        }

        // Wait for final response of module (after end of stream)
        let doneMessage = await donePromise;
        this.removeStreamListener(id);

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to stream response. Error: " + doneMessage.error);
        }
        return;
    }

    async interrupt(): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("interrupt_ack", id);

        // Send request to module
        await this.sendToModule({
            type: "interrupt",
            unique_request_id: id
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("interrupt timed out, LLM module may be closed.");
        }
    }

    async close(): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("close_ack", id);

        // Send request to module
        await this.sendToModule({
            type: "close",
            unique_request_id: id
        });

        // Race the promises (first to fulfill will return)
        await Promise.race([timeoutPromise, acknowledgementPromise]);
        // If timeout then module is likely already closed
    }

    async getProviders(): Promise<LlmProviderListType>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("get_providers_done", id);

        // Send request to module
        await this.sendToModule({
            type: "get_providers",
            unique_request_id: id
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("getProviders timed out, LLM module may be closed.");
        }

        return raceResult.providers;
    }

    async getModels(): Promise<string[]>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise<undefined>(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("get_models_done", id);

        // Send request to module
        await this.sendToModule({
            type: "get_models",
            unique_request_id: id
        });

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeAllListeners(id);
            throw Error("getModels timed out, LLM module may be closed.");
        }

        return raceResult.models;
    }
}

async function main(): Promise<void>
{
    let client = new wAIfuLlmClient();

    let stdinReader = readline.createInterface(process.stdin, process.stdout);
    let apiKey = await stdinReader.question("[INPUT] OpenAI API Key: ");

    await client.loadProvider("openai", {
        api_key: apiKey
    });

    console.log("[INP] User: What is 9 + 10 equal to?");

    let response = await client.generate([
        {
            role: "user",
            content: "What is 9 + 10 equal to?"
        }
    ], {
        model_id: "gpt-4o-mini",
        character_name: "AI",
        max_output_length: 250,
        temperature: 1.0,
        stop_tokens: null,
        timeout_ms: 5_000,
    });

    console.log("[OUT] AI:", response);

    console.log("[INP] User: Write me a very long story, as long as possible.");
    process.stdout.write("[OUT] AI: ");

    await client.generateStream([
        {
            role: "user",
            content: "Write me a very long story, as long as possible."
        }
    ], {
        model_id: "gpt-4o-mini",
        character_name: "AI",
        max_output_length: 500,
        temperature: 1.0,
        stop_tokens: null,
        timeout_ms: 5_000,
    }, (chunk: string) => {
        process.stdout.write(chunk);
    });

    process.stdout.write("\n");

    console.log("[LOG] Done.");
}

setImmediate(main);