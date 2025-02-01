# w-AI-fu SDK LLM Module

## What is it
This is the LLM module of the modular w-AI-fu SDK.
It is a standalone module able to operate and communicate alongside any client applications via WebSocket.
  
The goal of this module is to integrate as many LLMs as possible into a single module.

## Principles
### Minimal Dependencies
A main principle of the module will be one of minimal dependencies.
Since there will be so many LLMs, there is a very high likelihood that downloading
every dependencies for every LLMs available would be time consuming and a considerable
waste of disk memory.

In simpler words, you only install what you use.

### No Conflicts
Python venvs everywhere.

## Client Example
A client example is available in the example_client.ts file.

```typescript
// from example_client.ts
let client = new wAIfuLlmClient();

let providers = await client.getProviders();
console.log("[LOG] Available providers:", providers);

let stdinReader = readline.createInterface(process.stdin, process.stdout);
let provider = (await stdinReader.question("[INPUT] Provider: ")) as LlmProviderName;
let apiKey = await stdinReader.question("[INPUT] API Key: ");

await client.loadProvider(provider, {
    api_key: apiKey
});

let models = await client.getModels();
console.log("[LOG] Available models:", models);
let model = await stdinReader.question("[INPUT] Model ID: ");

console.log("[INP] User: How are you feeling?");

let response = await client.generate([
    {
        role: "user",
        content: "How are you feeling?"
    }
], {
    model_id: model,
    character_name: "AI",
    max_output_length: 250,
    temperature: 1.0,
    stop_tokens: null,
    timeout_ms: null,
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
    model_id: model,
    character_name: "AI",
    max_output_length: 500,
    temperature: 1.0,
    stop_tokens: null,
    timeout_ms: 15_000,
}, (chunk: string) => {
    process.stdout.write(chunk);
});

process.stdout.write("\n");
console.log("[LOG] Done.");
```

## WebSocket API
### Input (from client application)
Input message types:
```js
["load", "generate", "interrupt", "close", "get_providers", "get_models"]
```

Load provider:
```js
{
    "type": "load",
    "unique_request_id": "<id unique to request>",
    "provider": "openai", // "groq" | "novelai" | ...,
    "api_key": "<api key>", // (optional, required by API llms),
    "preload_model_id": "<model id>" // (optional, useful for local llms)
}
```
Important: the load message may require a "api_key" field or other fields depending on the needs of the implementation.

load
1. load_ack
2. load_done

Generate:
```js
{
    "type": "generate",
    "unique_request_id": "<id unique to request>",
    "messages": [
        {
            "role": "system",
            "content": "This is a system prompt"
        },
        {
            "role": "user",
            "content": "erm",
            "name": "DEV" // or missing
        }
    ],
    "params": {
        "model_id": "gpt-4o-mini",
        "character_name": "Mia",
        "temperature": 1.0,
        "max_output_length": 200,
        "stop_tokens": ["\r", "\n"], // or null
        "timeout_ms": 10000 // or null
        // In stream mode, timeout is refreshed at every new chunk received
    },
    "stream": false
}
```

generate (stream:false)
1. generate_ack
2. generate_done

generate (stream:true)
1. generate_ack
2. generate_stream_chunk (x amount of chunks)
3. generate_stream_done

Interrupt:
```js
{
    "type": "interrupt",
    "unique_request_id": "<id unique to request>",
}
```

interrupt
1. interrupt_ack

Close module:
```js
{
    "type": "close",
    "unique_request_id": "<id unique to request>",
}
```

close
1. close_ack

Get available providers:
```js
{
    "type": "get_providers",
    "unique_request_id": "<id unique to request>",
}
```

get_providers
1. get_providers_done

Get available models from provider:
```js
{
    "type": "get_models",
    "unique_request_id": "<id unique to request>",
}
```
This can only be done after a provider has already been loaded.

get_models
1. get_models_done

---
### Output (from LLM module)
Output message types:
```js
["load_ack", "generate_ack", "interrupt_ack", "close_ack", "load_done", "generate_done", "generate_streamed", "generate_stream_done", "generate_stream_chunk", "get_providers_done", "get_models_done"]
```

Provider load acknowledgment:
```js
{
    "type": "load_ack",
    "unique_request_id": "<id of initial request>",
    "provider": "openai" // "groq" | "novelai" | ...
}
```

Provider load done:
```js
{
    "type": "load_done",
    "unique_request_id": "<id of initial request>",
    "provider": "openai" // "groq" | "novelai" | ...,
    "is_error": false,
    "error": "SUCCESS" // or "<error type>" if is_error is true
}
```

Generate acknowledgment:
```js
{
    "type": "generate_ack",
    "unique_request_id": "<id of initial request>"
}
```

Generate response:
```js
{
    "type": "generate_done",
    "unique_request_id": "<id of initial request>",
    "is_error": false,
    "error": "SUCCESS", // or "<error type>" if is_error is true
    "response": "llm response" // or "" if is_error is true
}
```

Generate stream chunk:
```js
{
    "type": "generate_stream_chunk",
    "unique_request_id": "<id of initial request>",
    "chunk": "<chunk of response>"
}
```

Generate stream done:
```js
{
    "type": "generate_stream_done",
    "unique_request_id": "<id of initial request>",
    "is_error": false,
    "error": "SUCCESS", // or "<error type>" if is_error is true
}
```

Interrupt acknowledgment:
```js
{
    "type": "interrupt_ack",
    "unique_request_id": "<id of initial request>",
}
```

Close acknowledgment:
```js
{
    "type": "close_ack",
    "unique_request_id": "<id of initial request>",
}
```

Get providers done:
```js
{
    "type": "get_providers_done",
    "unique_request_id": "<id of initial request>",
    "providers": ["<list of providers>"]
}
```

Get models done:
```js
{
    "type": "get_models_done",
    "unique_request_id": "<id of initial request>",
    "providers": ["<list of model ids>"]
}
```
  
---
### Error types
```typescript
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
```

## Requirements
NodeJS version >= v20.9.0 (v20.9.0 tested)  
Python 3.10 (if required by LLM implementation)

## TODO
- [x] LLM Interface definition
- [x] IN/OUT Message protocol definition
- [x] Incoming socket messages handler
- [x] OpenAI LLM implementation
- [x] NovelAI LLM implementation
- [x] Groq LLM implementation
- [ ] DeepSeek LLM implementation
- [ ] Ollama LLMs implementation
- [ ] Eventual solution for local models (hugging face, ollama)