export enum LLM_GEN_ERR {
    SUCCESS = "SUCCESS",
    UNEXPECTED = "UNEXPECTED",
    AUTHORIZATION = "AUTHORIZATION",
    INVALID_PROMPT = "INVALID_PROMPT",
    TIMEOUT = "TIMEOUT",
};

export type LlmSyncResult = {
    error: LLM_GEN_ERR,
    maybeValue: string,
};

export type LlmMessage = {
    role: "function" | "tool" | "system" | "user" | "assistant";
    content: string;
    name: string | undefined | null;
};

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