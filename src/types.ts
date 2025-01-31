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

export type LlmSyncResult = {
    error: LLM_GEN_ERR,
    maybeValue: string,
};

export type LlmMessage = {
    role: "function" | "tool" | "system" | "user" | "assistant";
    content: string;
    name?: string | undefined
}

export type LlmStreamChunk = {
    done: boolean,
    chunk: string
};

export class LlmGenParams {
    model_id: string = "";
    character_name: string = "";
    temperature: number = 1.0;
    max_output_length: number = 200;
    stop_tokens: string[] | number[] | undefined | null = ["\r", "\n"];
    timeout_ms: number | undefined | null = 60_000;
}

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

export let LlmProviderList = ["openai", "novelai", "groq"] as const;
export type LlmProviderName = typeof LlmProviderList[number];

export type OutDataBase = {
    type: MessageOutType,
    unique_request_id: string,
}

export type LoadDoneResponse = OutDataBase & {
    type: "load_done";
    provider: LlmProviderName
    is_error: boolean;
    error: LLM_GEN_ERR;
}

export type GenerateDoneResponse = OutDataBase & {
    type: "generate_done"
    is_error: boolean;
    error: LLM_GEN_ERR;
    response: string;
}

export type StreamChunkResponse = OutDataBase & {
    type: "generate_stream_chunk"
    chunk: string;
}

export type StreamDoneResponse = OutDataBase & {
    type: "generate_stream_done"
    is_error: boolean;
    error: LLM_GEN_ERR;
}

export type GetProvidersDoneResponse = OutDataBase & {
    type: "get_providers_done"
    providers: typeof LlmProviderList;
}

export type GetModelsDoneResponse = OutDataBase & {
    type: "get_models_done"
    models: string[];
}

export type LoadAcknowledgement = OutDataBase & {
    type: "load_ack",
    provider: LlmProviderName
}

export type GenerateAcknowledgement = OutDataBase & {
    type: "generate_ack"
}

export type InterruptAcknowledgement = OutDataBase & {
    type: "interrupt_ack"
}

export type CloseAcknowledgement = OutDataBase & {
    type: "close_ack"
}

export type MessageTypeMap =  {
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

export type StrictMessageData<K extends MessageOutType> = MessageTypeMap[K] & { type: K };