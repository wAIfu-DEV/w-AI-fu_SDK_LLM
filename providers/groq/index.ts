import { LargeLanguageModel } from "../../src/LlmInterface"
import { LLM_GEN_ERR, LlmGenParams, LlmMessage, LlmStreamChunk, LlmSyncResult } from "../../src/types";

import { Groq } from "groq-sdk"

class LargeLanguageModelGroq implements LargeLanguageModel {
    #client?: Groq = undefined;

    interruptNext = false;

    async Init(loadRequest: Record<string, any>): Promise<LLM_GEN_ERR> {
        
        if (loadRequest["api_key"] == undefined)
        {
            console.error("[ERROR] Request to load groq provider failed.");
            console.error("[ERROR] Request object is missing specific field \"api_key\"");
            console.error("[ERROR] Example:", {
                type: "load",
                provider: "groq",
                api_key: "<api key>"
            });
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        
        this.#client = new Groq({
            apiKey: loadRequest["api_key"]
        });

        try {
            await this.#client.models.list();
        } catch (error) {
            console.error("[ERROR] Test request to groq failed, assuming invalid API key.");
            console.error("[ERROR] Actual error:", error);
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        return LLM_GEN_ERR.SUCCESS;
    }

    async Free() {}

    async GetModels(): Promise<string[]> {
        let models = await this.#client!.models.list();
        return models.data.map(v => v.id);
    }

    Generate(messages: LlmMessage[],
             params: LlmGenParams): Promise<LlmSyncResult> {
        
        this.interruptNext = false;
        return new Promise(async resolve => {
            let finished: boolean = false;
            let timeout: NodeJS.Timeout | undefined = undefined;

            let abortController = new AbortController();

            if (params.timeout_ms)
            {
                setTimeout(() => {
                    if (finished) return;
                    finished = true;
                    abortController.abort();
                    console.error("[ERROR] Generate timeout, request took longer than", params.timeout_ms, "ms.");
                    resolve({
                        error: LLM_GEN_ERR.TIMEOUT,
                        maybeValue: "",
                    });
                }, params.timeout_ms)
            }

            try
            {
                var completion = await this.#client!.chat.completions.create({
                    messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
                    model: params.model_id,
                    temperature: params.temperature,
                    max_completion_tokens: params.max_output_length,
                    stop: params.stop_tokens as string[] | undefined,
                    stream: false,
                }, {
                    signal: abortController.signal
                });
            }
            catch (e)
            {
                if (finished) return;
                finished = true;
                console.error("[ERROR] Unexpected Generate error.");
                console.error("[ERROR] Error:", e);
                resolve({
                    error: LLM_GEN_ERR.UNEXPECTED,
                    maybeValue: ""
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
                maybeValue: completion.choices[0].message.content ?? "",
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

            let abortController: AbortController | undefined = undefined;

            if (params.timeout_ms)
            {
                timeout = setTimeout(() => {
                    if (finished) return;
                    finished = true;
                    if (abortController) abortController.abort();
                    console.error("[ERROR] GenerateStream timeout, request took longer than", params.timeout_ms, "ms.");
                    resolve(LLM_GEN_ERR.TIMEOUT);
                }, params.timeout_ms)
            }

            try {
                var stream = await this.#client!.chat.completions.create({
                    messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
                    model: params.model_id,
                    temperature: params.temperature,
                    max_completion_tokens: params.max_output_length,
                    stop: params.stop_tokens as string[] | undefined,
                    stream: true,
                });
            }
            catch(e)
            {
                if (finished) return;
                finished = true;
                console.error("[ERROR] Unexpected GenerateStream error.");
                console.error("[ERROR] Error:", e);
                resolve(LLM_GEN_ERR.UNEXPECTED);
                return;
            }

            abortController = stream.controller;

            for await (let chunk of stream) {
                if (finished || this.interruptNext)
                {
                    abortController.abort();
                    break;
                }

                // refresh timeout
                if (timeout)
                {
                    timeout = timeout.refresh();
                }

                await callback({
                    done: false,
                    chunk: chunk.choices[0]?.delta?.content ?? "",
                });
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

exports.Model = new LargeLanguageModelGroq();