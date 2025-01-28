# w-AI-fu SDK LLM Module

## What is it
This is the LLM module of the modular w-AI-fu SDK.
It is a standalone module able to operate by itself and communicate with any client applications via WebSocket.
  
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
Load model:
```json
{
    "type": "load",
    "llm": "openai" | "groq" | "novelai" | ...
}
```

Generate:
```json
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
            "name": "DEV" | null
        }
    ],
    "params": {
        "model_id": "gpt4o-mini",
        "character_name": "Hilda",
        "temperature": 1.0,
        "max_output_length": 200,
        "stop_tokens": ["\r", "\n"],
        "timeout_ms": 10000 | null
    },
    "stream": false
}
```

Interrupt:
```json
{
    "type": "interrupt"
}
```

Close module:
```json
{
    "type": "close"
}
```
---
### Output (from LLM module)
Model load acknowledgment:
```json
{
    "type": "load_ack",
    "llm": "openai" | "groq" | "novelai" | ...
}
```

Model load done:
```json
{
    "type": "load_done",
    "llm": "openai" | "groq" | "novelai" | ...
}
```

Generate acknowledgment:
```json
{
    "type": "generate_ack",
    "unique_request_id": "<id of initial request>"
}
```

Generate response:
```json
{
    "type": "generate_done",
    "unique_request_id": "<id of initial request>",
    "is_error": false,
    "error": 0 | <error code>,
    "response": "llm response" | null
}
```

Generate stream chunk:
```json
{
    "type": "generate_stream_chunk",
    "unique_request_id": "<id of initial request>",
    "chunk": "streamed chunk"
}
```

Generate stream done:
```json
{
    "type": "generate_stream_done",
    "unique_request_id": "<id of initial request>",
    "is_error": false,
    "error": 0 | <error code>
}
```

Interrupt acknowledgment:
```json
{
    "type": "interrupt_ack"
}
```

Close acknowledgment:
```json
{
    "type": "close_ack"
}
```


## TODO
- [x] LLM Interface definition
- [ ] IN/OUT Message protocol definition
- [ ] Incoming socket messages handler
- [ ] OpenAI LLM implementation
- [ ] NovelAI LLM implementation
- [ ] Groq LLM implementation
- [ ] DeepSeek LLM implementation
- [ ] Eventual solution for local models (hugging face, ollama)