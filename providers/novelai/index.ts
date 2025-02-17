import { LargeLanguageModel } from "../../src/LlmInterface"
import { LLM_GEN_ERR, LlmGenParams, LlmMessage, LlmStreamChunk, LlmSyncResult } from "../../src/types";

import { NovelAI, NovelAiTextModel, availableModels } from "./novelai"

class LargeLanguageModelNovelAI implements LargeLanguageModel {
    #client?: NovelAI = undefined;

    interruptNext = false;

    async Init(loadRequest: Record<string, any>): Promise<LLM_GEN_ERR> {
        
        if (loadRequest["api_key"] == undefined)
        {
            console.error("[ERROR] Request to load novelai provider failed.");
            console.error("[ERROR] Request object is missing specific field \"api_key\"");
            console.error("[ERROR] Example:", {
                type: "load",
                provider: "novelai",
                api_key: "<api key>"
            });
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        
        this.#client = new NovelAI({
            apiKey: loadRequest["api_key"]
        });

        try {
            await this.#client.generateText("test", "llama-3-erato-v1", {
                max_length: 10,
            });
        } catch (error) {
            console.error("[ERROR] Test request to novelai failed, assuming invalid API key.");
            console.error("[ERROR] Actual error:", error);
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        return LLM_GEN_ERR.SUCCESS;
    }

    async Free() {}

    async GetModels(): Promise<string[]> {
        return availableModels;
    }

    Generate(messages: LlmMessage[],
             params: LlmGenParams): Promise<LlmSyncResult> {
        
        this.interruptNext = false;
        return new Promise(async resolve => {
            let finished: boolean = false;
            let timeout: NodeJS.Timeout | undefined = undefined;

            if (params.timeout_ms)
            {
                setTimeout(() => {
                    if (finished) return;
                    finished = true;
                    console.error("[ERROR] Generate timeout, request took longer than", params.timeout_ms, "ms.");
                    resolve({
                        error: LLM_GEN_ERR.TIMEOUT,
                        maybeValue: "",
                    });
                }, params.timeout_ms)
            }

            if (!availableModels.includes(params.model_id))
            {
                finished = true;
                console.error("[ERROR] Generate error, model_id is not a valid NovelAI model.");
                console.error("[ERROR] Valid NovelAI model:", availableModels.join(", "));
                resolve({
                    error: LLM_GEN_ERR.INVALID_MODEL,
                    maybeValue: "",
                });
                return;
            }

            try {
                var response = await this.#client!.generateChat(
                    messages,
                    params.model_id as NovelAiTextModel,
                    {
                        assistantName: params.character_name,
                        systemPrompt: "",
                    }
                );
            }
            catch (e)
            {
                finished = true;
                console.error("[ERROR] Unexpected Generate error.");
                console.error("[ERROR] Error:", e);
                resolve({
                    error: LLM_GEN_ERR.UNEXPECTED,
                    maybeValue: "",
                });
                return;
            }

            if (finished)
            {
                return;
            }

            finished = true;
            clearTimeout(timeout);

            if (this.interruptNext)
            {
                resolve({
                    error: LLM_GEN_ERR.INTERRUPT,
                    maybeValue: "",
                });
                return;
            }

            resolve({
                error: LLM_GEN_ERR.SUCCESS,
                maybeValue: response,
            });
            return;
        });
    }

    GenerateStream(messages: LlmMessage[],
                   params: LlmGenParams,
                   callback: (chunk: LlmStreamChunk) => any): Promise<LLM_GEN_ERR> {
        
        this.interruptNext = false;
        return new Promise(async resolve => {
            let finished: boolean = false;
            let timeout: NodeJS.Timeout | undefined = undefined;

            if (params.timeout_ms)
            {
                timeout = setTimeout(() => {
                    if (finished) return;
                    finished = true;
                    console.error("[ERROR] GenerateStream timeout, request took longer than", params.timeout_ms, "ms.");
                    resolve(LLM_GEN_ERR.TIMEOUT);
                }, params.timeout_ms)
            }

            if (!availableModels.includes(params.model_id))
            {
                finished = true;
                console.error("[ERROR] GenerateStream error, model_id is not a valid NovelAI model.");
                console.error("[ERROR] Valid NovelAI model:", availableModels.join(", "));
                resolve(LLM_GEN_ERR.INVALID_MODEL);
                return;
            }

            try {
                await this.#client!.generateChatStreamed(
                    messages,
                    params.model_id as NovelAiTextModel,
                    {
                        assistantName: params.character_name,
                        systemPrompt: "",
                    },
                    async (chunk) => {
                        if (finished) return;
                        if (this.interruptNext) return;

                        // refresh timeout
                        if (timeout)
                        {
                            timeout = timeout.refresh()
                        }

                        await callback({
                            done: false,
                            chunk: chunk,
                        });
                    }
                );
            }
            catch (e)
            {
                finished = true;
                console.error("[ERROR] Unexpected GenerateStream error.");
                console.error("[ERROR] Error:", e);
                resolve(LLM_GEN_ERR.UNEXPECTED);
                return;
            }

            await callback({
                done: true,
                chunk: "",
            });

            if (finished)
            {
                return;
            }
            
            finished = true;
            clearTimeout(timeout);

            if (this.interruptNext)
            {
                resolve(LLM_GEN_ERR.INTERRUPT);
                return;
            }

            resolve(LLM_GEN_ERR.SUCCESS);
            return;
        });
    }

    async Interrupt(this: LargeLanguageModel) {
        this.interruptNext = true;
    }
}

exports.Model = new LargeLanguageModelNovelAI();