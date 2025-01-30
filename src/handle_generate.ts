import WebSocket from "ws";
import { IncomingMessage } from "./receive_handler";
import { LLM_GEN_ERR, LlmMessage, LlmStreamChunk } from "./types";
import { state } from "./global_state";

type GenerateMessage = {
    type: "generate",
    unique_request_id: string,
    messages: LlmMessage[],
    params: {
        model_id: string,
        character_name: string,
        temperature: number,
        max_output_length: number,
        stop_tokens: string[] | number[] | undefined | null,
        timeout_ms: number | null
    },
    stream: boolean
}

const exampleGenMessage: GenerateMessage = {
    type: "generate",
    unique_request_id: crypto.randomUUID(),
    messages: [
        {
            role: "system",
            content: "This is a system prompt"
        },
        {
            role: "user",
            content: "erm",
            name: "DEV"
        }
    ],
    params: {
        model_id: "gpt-4o-mini",
        character_name: "Mia",
        temperature: 1.0,
        max_output_length: 200,
        stop_tokens: ["\r", "\n"],
        timeout_ms: null
    },
    stream: false
}

function RequiredFieldError(fieldName: string)
{
    console.error(`[ERROR] Incoming generate message does not have the required field [\"${fieldName}\"].`);
    console.error("[ERROR] Example:", exampleGenMessage);
    console.error("[ERROR] Refer to the README file for more information about generate messages.");
}

export async function HandleGenerateRequest(socket: WebSocket, message: IncomingMessage): Promise<void>
{
    if (state.largeLanguageModel == undefined)
    {
        console.error(`[ERROR] Failed to generate, no model is currently loaded.`);
        return;
    }

    const requiredFields = [
        "unique_request_id",
        "messages",
        "params",
        "stream"
    ];

    for (let requField of requiredFields)
    {
        if (message[requField] === undefined)
        {
            RequiredFieldError(requField);
            return;
        }
    }

    let paramsObj = message["params"];

    const requiredParams = [
        "model_id",
        "character_name",
        "temperature",
        "max_output_length",
        "stop_tokens",
        "timeout_ms"
    ];

    for (let requParam of requiredParams)
    {
        if (paramsObj[requParam] === undefined)
        {
            RequiredFieldError(`params"]["${requParam}`);
            return;
        }
    }

    let generateMessage = message as GenerateMessage;

    // Acknowledge generate request
    socket.send(JSON.stringify({
        type: "generate_ack",
        unique_request_id: generateMessage.unique_request_id
    }));

    if (generateMessage.stream)
    {
        const responseError = await state.largeLanguageModel.GenerateStream(
            generateMessage.messages,
            generateMessage.params,
            (chunk: LlmStreamChunk) => {
                if (chunk.done) return;
                socket.send(JSON.stringify({
                    type: "generate_stream_chunk",
                    unique_request_id: generateMessage.unique_request_id,
                    chunk: chunk.chunk
                }));
            }
        );

        let isError = responseError != LLM_GEN_ERR.SUCCESS;
        if (isError)
        {
            console.error("[ERROR] Error during streamed generation.");
            console.error("[ERROR] Error type:", responseError);
        }

        socket.send(JSON.stringify({
            type: "generate_stream_done",
            unique_request_id: generateMessage.unique_request_id,
            is_error: isError,
            error: responseError
        }));
    }
    else
    {
        const response = await state.largeLanguageModel.Generate(
            generateMessage.messages,
            generateMessage.params
        );

        let isError = response.error != LLM_GEN_ERR.SUCCESS;
        if (isError)
        {
            console.error("[ERROR] Error during generation.");
            console.error("[ERROR] Error type:", response.error);
        }

        socket.send(JSON.stringify({
            type: "generate_done",
            unique_request_id: generateMessage.unique_request_id,
            is_error: isError,
            error: response.error,
            response: response.maybeValue
        }));
    }
}