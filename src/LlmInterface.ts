import { 
    LlmSyncResult,
    LlmMessage,
    LlmStreamChunk,
    LlmGenParams,
    LLM_GEN_ERR
} from "./types.ts";

export interface LargeLanguageModel
{
    /**
     * Flag indicating the need for a full interruption of the LLM operations.
     */
    interruptNext: boolean;

    /**
     * Initializes the dependencies of the internal implementation of the LLM.
     * Should return only after all dependencies are fully loaded and the LLM is
     * ready to handle a request.
     */
    Init(loadRequest: Record<string, any>): Promise<LLM_GEN_ERR>;

    /**
     * Un-initializes the dependencies loaded during the call to Init.
     * The state should be left exactly as it was before the call to Init.
     * All memory, processes or operations should be stopped and cleaned up.
     */
    Free(): Promise<void>;

    /**
     * Sends a request to the LLM to generate a response to the prompt.
     * Will wait until the full response is available before returning,
     * regardless of it the LLM supports streaming or not.
     * 
     * @param messages Array of messages forming the prompt
     * @param params Parameters for the LLM generation
     * @returns Struct containing an error code and a value (if error == SUCCESS)
     */
    Generate(messages: LlmMessage[],
             params: LlmGenParams): Promise<LlmSyncResult>;

    /**
     * Sends a request to the LLM to generate a response to the prompt.
     * Will return the response data in a streaming manner as soon as it is
     * available via a callback function.
     * When the generation is finished, a new empty chunk will be sent with the
     * "done" flag set to true.
     * 
     * If the LLM does not support streaming, the callback will be called twice,
     * once for the full response and once for the "done" chunk.
     * 
     * @param messages Array of messages forming the prompt
     * @param params Parameters for the LLM generation
     * @param callback Callback function receiving the streamed chunks
     * @returns Error code for status of execution
     */
    GenerateStream(messages: LlmMessage[],
                   params: LlmGenParams,
                   callback: (chunk: LlmStreamChunk) => any): Promise<LLM_GEN_ERR>;

    /**
     * Sends a request for interruption of the current generation(s)
     * Any operations currently done by the LLM module should be totally
     * stopped and reset to an idle state.
     * If the internal implementation of the LLM does not support interruption,
     * then the output (sync or streamed) should be cut off instead.
     */
    Interrupt(): Promise<void>;
}

export function VerifyInterfaceAdherence(llm: any, llmName: string): boolean
{
    if (llm.interruptNext == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field interruptNext.");
        return false;
    }

    if (llm.Init == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field Init.");
        return false;
    }

    if (llm.Free == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field Free.");
        return false;
    }

    if (llm.Generate == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field Generate.");
        return false;
    }

    if (llm.GenerateStream == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field GenerateStream.");
        return false;
    }

    if (llm.Interrupt == undefined)
    {
        console.error("[ERROR] Implementation of LLM", llmName, "failed to pass interface check.");
        console.error("[ERROR] Missing field Interrupt.");
        return false;
    }

    return true;
}