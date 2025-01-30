type MessageInType = "load"
                     | "generate"
                     | "interrupt"
                     | "close"
                     | "get_providers"
                     | "get_models";

type MessageOutType = "load_ack"
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

type LlmProviderName = "openai" | "novelai" | "groq";

type TaggedPromise = {
    promise: Promise<any>,
    resolve: (arg0: any) => any,
    id: string
}

type LlmMessage = {
    role: "function" | "tool" | "system" | "user" | "assistant";
    content: string;
    name?: string | undefined
}

type LlmStreamChunk = {
    done: boolean,
    chunk: string
};

class LlmGenParams {
    model_id: string = "";
    character_name: string = "";
    temperature: number = 1.0;
    max_output_length: number = 200;
    stop_tokens: string[] | number[] | undefined | null = ["\r", "\n"];
    timeout_ms: number | undefined | null = 60_000;
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
    listeners: Record<MessageOutType, Record<string, TaggedPromise>> = {
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

    incomingHandler(ev: MessageEvent)
    {
        let message = JSON.parse(ev.data.toString());
        let id = message.unique_request_id;

        // Necessary edge case since promises are one-time use
        if (message.type == "generate_stream_chunk")
        {
            // If we have a callback set for a call to generate with stream:on
            // We call it for each chunk we receive.
            // Here the id ensures we are sending the data to the right callback
            let callback = this.streamListeners[id];
            if (callback != undefined) callback(message.chunk);
        }
        else
        {
            let promise: TaggedPromise = this.listeners[message.type][id];
            promise.resolve(message);
            delete this.listeners[message.type][id];
        }
    }

    listenTo(messageType: MessageOutType, id: string): Promise<any>
    {
        let resolver!: (arg0: any) => any;

        let promise = new Promise(resolve => {
            resolver = resolve;
        });

        let taggedPromise = {
            id,
            resolve: resolver,
            promise
        }

        this.listeners[messageType][id] = taggedPromise;
        return taggedPromise.promise;
    }

    listenToStream(id: string, callback: (chunk: string) => any)
    {
        this.streamListeners[id] = callback;
    }

    removeStreamListener(id: string)
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
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("load_ack", id);
        let donePromise = this.listenTo("load_done", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "load",
            unique_request_id: id,
            provider: providerName,
            api_key: params.api_key,
            preload_model_id: params.preload_model_id
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            throw Error("loadProvider timed out, LLM module may be closed.");
        }

        // Wait for response of module
        let doneMessage = await donePromise;

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to load provider. Error:" + doneMessage.error);
        }
        return;
    }

    async generate(messages: LlmMessage[], params: LlmGenParams): Promise<string>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("generate_ack", id);
        let donePromise = this.listenTo("generate_done", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "generate",
            unique_request_id: id,
            messages,
            params,
            stream: false
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            throw Error("generate timed out, LLM module may be closed.");
        }

        // Wait for response of module
        let doneMessage = await donePromise;

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to generate response. Error:" + doneMessage.error);
        }
        return doneMessage.response;
    }

    async generateStream(messages: LlmMessage[], params: LlmGenParams, callback: (chunk: string) => any): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("generate_ack", id);
        let donePromise = this.listenTo("generate_done", id);
        this.listenToStream(id, callback);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "generate",
            unique_request_id: id,
            messages,
            params,
            stream: true
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            this.removeStreamListener(id);
            throw Error("generateStream timed out, LLM module may be closed.");
        }

        // Wait for final response of module (after end of stream)
        let doneMessage = await donePromise;

        this.removeStreamListener(id);

        // Handle possible errors
        if (doneMessage.is_error)
        {
            throw Error("Failed to stream response. Error:" + doneMessage.error);
        }
        return;
    }

    async interrupt(): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("interrupt_ack", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "interrupt",
            unique_request_id: id
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            throw Error("interrupt timed out, LLM module may be closed.");
        }
    }

    async close(): Promise<void>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("close_ack", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "close",
            unique_request_id: id
        }));

        // Race the promises (first to fulfill will return)
        await Promise.race([timeoutPromise, acknowledgementPromise]);
    }

    async getProviders(): Promise<string[]>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("get_providers_done", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "get_providers",
            unique_request_id: id
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            throw Error("interrupt timed out, LLM module may be closed.");
        }

        return raceResult.providers;
    }

    async getModels(): Promise<string[]>
    {
        // Generate unique ID
        let id = crypto.randomUUID();

        // Create acknowledgement timeout and listeners
        let timeoutPromise = new Promise(res => setTimeout(res, 1_000));
        let acknowledgementPromise = this.listenTo("get_models_done", id);

        // Send request to module
        this.socket.send(JSON.stringify({
            type: "get_models",
            unique_request_id: id
        }));

        // Race the promises (first to fulfill will return)
        let raceResult = await Promise.race([timeoutPromise, acknowledgementPromise]);

        // If timeout promise fulfilled first
        if (raceResult == undefined)
        {
            throw Error("interrupt timed out, LLM module may be closed.");
        }

        return raceResult.providers;
    }
}

async function main()
{
    let client = new wAIfuLlmClient();

    await client.loadProvider("openai", {
        api_key:  "<api key>"
    });

    console.log("User: What is 9 + 10 equal to?");

    let response = await client.generate([
        {
            role: "user",
            content: "What is 9 + 10 equal to?"
        }
    ], {
        model_id: "gpt4o-mini",
        character_name: "AI",
        max_output_length: 250,
        temperature: 1.0,
        stop_tokens: null,
        timeout_ms: 20_000,
    });

    console.log("AI:", response);
}

setImmediate(main);