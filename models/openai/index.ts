import { LargeLanguageModel } from "../../src/LlmInterface"
import { LLM_GEN_ERR, LlmGenParams, LlmMessage, LlmStreamChunk, LlmSyncResult } from "../../src/types";

import { OpenAI } from "openai"

class LargeLanguageModelOpenai implements LargeLanguageModel {
    #client?: OpenAI = undefined;

    interruptNext = false;

    async Init(loadRequest: Record<string, any>): Promise<LLM_GEN_ERR> {
        
        if (loadRequest["api_key"] == undefined)
        {
            console.error("[ERROR] Request to load openai model failed.");
            console.error("[ERROR] Request object is missing specific field \"api_key\"");
            console.error("[ERROR] Example:", {
                type: "load",
                llm: "openai",
                api_key: "<api key>"
            });
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        
        this.#client = new OpenAI({
            apiKey: loadRequest["api_key"]
        });

        try {
            await this.#client.models.list();
        } catch (error) {
            console.error("[ERROR] Test request to openai failed, assuming invalid API key.");
            return LLM_GEN_ERR.AUTHORIZATION;
        }
        return LLM_GEN_ERR.SUCCESS;
    }

    async Free() {}

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

            try
            {
                var completion = await this.#client!.chat.completions.create({
                    messages: messages as OpenAI.ChatCompletionMessageParam[],
                    model: params.model_id,
                    temperature: params.temperature,
                    stop: params.stop_tokens as string[] | undefined,
                    stream: false,
                });
            }
            catch (e)
            {
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

            if (params.timeout_ms)
            {
                timeout = setTimeout(() => {
                    if (finished) return;
                    finished = true;
                    console.error("[ERROR] GenerateStream timeout, request took longer than", params.timeout_ms, "ms.");
                    resolve(LLM_GEN_ERR.TIMEOUT);
                }, params.timeout_ms)
            }

            try {
                var stream = await this.#client!.chat.completions.create({
                    messages: messages as OpenAI.ChatCompletionMessageParam[],
                    model: params.model_id,
                    temperature: params.temperature,
                    stop: params.stop_tokens as string[] | undefined,
                    stream: true,
                });
            }
            catch(e)
            {
                finished = true;
                console.error("[ERROR] Unexpected GenerateStream error.");
                console.error("[ERROR] Error:", e);
                resolve(LLM_GEN_ERR.UNEXPECTED);
                return;
            }

            for await (let chunk of stream) {
                if (finished) break;
                if (this.interruptNext) break;

                // refresh timeout
                if (timeout)
                {
                    timeout = timeout.refresh()
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

exports.Model = new LargeLanguageModelOpenai();