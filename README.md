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

## API Suggestion

### Input (from client application)
Load provider:
```js
{
    "type": "load",
    "unique_request_id": "<id unique to request>",
    "provider": "openai", // "groq" | "novelai" | ...,
    "api_key": "<api key>", // (optional, useful for API llms),
    "preload_model_id": "<model id>" // (optional, useful for local llms)
}
```
Important: the load message may require a "api_key" field or other fields depending on the needs of the implementation.

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
            "name": "DEV" // or null
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

Interrupt:
```js
{
    "type": "interrupt",
    "unique_request_id": "<id unique to request>",
}
```

Close module:
```js
{
    "type": "close",
    "unique_request_id": "<id unique to request>",
}
```

Get available providers:
```js
{
    "type": "get_providers",
    "unique_request_id": "<id unique to request>",
}
```

Get available models from provider:
```js
{
    "type": "get_models",
    "unique_request_id": "<id unique to request>",
}
```
This can only be done after a provider has already been loaded.
---
### Output (from LLM module)
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

## Requirements
NodeJS version >= v20.9.0 (v20.9.0 tested)
Python 3.10 (if required by LLM implementation)

## Client Example
A client example is available in the example_client.ts file.

```typescript
// from example_client.ts
let client = new wAIfuLlmClient();

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
    temperature: 0.7,
    stop_tokens: ["\n"],
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
    max_output_length: 750,
    temperature: 1.3,
    timeout_ms: 5_000,
}, (chunk: string) => {
    process.stdout.write(chunk);
});
// generateStream exits after last chunk is received

process.stdout.write("\n");
console.log("[LOG] Done.");
```

## TODO
- [x] LLM Interface definition
- [x] IN/OUT Message protocol definition
- [x] Incoming socket messages handler
- [x] OpenAI LLM implementation
- [x] NovelAI LLM implementation
- [x] Groq LLM implementation
- [ ] DeepSeek LLM implementation
- [ ] Eventual solution for local models (hugging face, ollama)