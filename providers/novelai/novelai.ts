/**
 * @author w-AI-fu_DEV
 * @license MIT
 */

class NovelAiError extends Error {}

export const availableModels = ["kayra-v1", "llama-3-erato-v1"];

export const chatStopSequences = [[91, 78694, 851, 91], [91, 7413, 3659, 4424, 91], [91, 408, 3659, 4424, 91], [128006, 198], [128007, 198]];
const chatBannedTokens = [[32352]];

type ConstructOptions = {
    apiKey: string;
};

export type NovelAiTextModel = "kayra-v1" | "llama-3-erato-v1";

type TextGenOptions = {
    max_length?: number | undefined,
    min_length?: number | undefined,
    top_p?: number | undefined,
    repetition_penalty?: number | undefined,
    repetition_penalty_range?: number | undefined,
    repetition_penalty_slope?: number | undefined,
    repetition_penalty_frequency?: number | undefined,
    repetition_penalty_presence?: number | undefined,
    phrase_rep_pen?: string | undefined,
    math1_temp?: number | undefined,
    math1_quad?: number | undefined,
    math1_quad_entropy_scale?: number | undefined,
    bad_words_ids?: number[][] | undefined,
    repetition_penalty_whitelist?: number[] | undefined,
    generate_until_sentence?: boolean | undefined,
    use_cache?: boolean | undefined,
    use_string?: boolean | undefined,
    return_full_text?: boolean | undefined,
    prefix?: string | undefined,
    num_logprobs?: number | undefined,
    order?: number[] | undefined,
    bracket_ban?: boolean | undefined,
    stop_sequences?: number[][] | undefined
}

const DefaultTextGenOptions: TextGenOptions = {
    max_length: 75,
    min_length: 1,
    top_p: 0.995,
    repetition_penalty: 1.5,
    repetition_penalty_range: 2240,
    repetition_penalty_slope: 1,
    repetition_penalty_frequency: 0,
    repetition_penalty_presence: 0,
    phrase_rep_pen: "light",
    math1_temp: 0.5,
    math1_quad: 0.19,
    math1_quad_entropy_scale: -0.08,
    bad_words_ids: [
        [
            16067
        ],
        [
            933,
            11144
        ],
        [
            25106,
            11144
        ],
        [
            58,
            106901,
            16073,
            33710,
            25,
            109933
        ],
        [
            933,
            58,
            11144
        ],
        [
            128030
        ],
        [
            58,
            30591,
            33503,
            17663,
            100204,
            25,
            11144
        ],
        [
            933,
            34184,
            11144
        ],
        [
            933,
            34184,
            23249
        ],
        [
            120582
        ],
        [
            34184,
            3597
        ]
    ],
    repetition_penalty_whitelist: [
        6,
        1,
        11,
        13,
        25,
        198,
        12,
        9,
        8,
        279,
        264,
        459,
        323,
        477,
        539,
        912,
        374,
        574,
        1051,
        1550,
        1587,
        4536,
        5828,
        15058,
        3287,
        3250,
        1461,
        1077,
        813,
        11074,
        872,
        1202,
        1436,
        7846,
        1288,
        13434,
        1053,
        8434,
        617,
        9167,
        1047,
        19117,
        706,
        12775,
        649,
        4250,
        527,
        7784,
        690,
        2834,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        1210,
        1359,
        608,
        220,
        596,
        956,
        3077,
        44886,
        4265,
        3358,
        2351,
        2846,
        311,
        389,
        315,
        304,
        520,
        505,
        430
    ],
    generate_until_sentence: true,
    use_cache: false,
    use_string: true,
    return_full_text: false,
    prefix: "vanilla",
    num_logprobs: 10,
    order: [
        9,
        2
    ],
    bracket_ban: true,
    stop_sequences: [[27, 91, 78694, 851, 91, 29]]
}

export class NovelAI
{
    #apiKey: string = "";

    constructor(options: ConstructOptions)
    {
        if (options.apiKey)
        {
            this.#apiKey = options.apiKey;
        }
        else
        {
            throw new NovelAiError("Cannot connect to NovelAI as no apiKey was provided.");
        }
    }

    #mergeObjects<T extends {}>(base: T, overwrite: T): T
    {
        let res = {};
        for (let [entryName, entryValue] of Object.entries(base))
        {
            let overwriteFieldValue = overwrite[entryName];
            res[entryName] = (overwriteFieldValue !== undefined) ? overwriteFieldValue : entryValue;
        }
        return res as T;
    }

    async generateChat(messages: ChatEntry[], model: NovelAiTextModel = "llama-3-erato-v1", options: ChatPromptBuilderConstructorOptions = {})
    {
        let chatBuilder = new ChatPromptBuilder(options);
        let prompt = chatBuilder.build(messages);
    
        let resp = await this.generateText(prompt, model, {
            stop_sequences: chatStopSequences,
            bad_words_ids: chatBannedTokens,
            bracket_ban: false,
            max_length: 250
        });

        return resp.replace(/<\|.*\|>/g, "").replace(/<\|.*\|/g, "").trim();
    }

    async generateChatStreamed(messages: ChatEntry[], model: NovelAiTextModel = "llama-3-erato-v1", options: ChatPromptBuilderConstructorOptions = {}, callback: (chunk: string) => any)
    {
        let chatBuilder = new ChatPromptBuilder(options);
        let prompt = chatBuilder.build(messages);
    
        await this.generateTextStreamed(prompt, model, {
            stop_sequences: chatStopSequences,
            bad_words_ids: chatBannedTokens,
            bracket_ban: false,
            max_length: 250
        }, async(chunk) => {
            await callback(chunk.replaceAll(/<\|.*\|>/g, "").replaceAll(/<\|.*\|/g, "").replaceAll(/<\|\w*/g, ""))
        });
    }

    async generateText(input: string, model: NovelAiTextModel = "llama-3-erato-v1", options: TextGenOptions | undefined = undefined): Promise<string>
    {
        let parameters: TextGenOptions | undefined = undefined;
        if (!options)
        {
            parameters = DefaultTextGenOptions
        }
        else
        {
            parameters = this.#mergeObjects<TextGenOptions>(
                                DefaultTextGenOptions, options);
        }

        const resp = await fetch('https://text.novelai.net/ai/generate', {
            method: 'POST', 
            headers: {
                'Authorization': 'Bearer ' + this.#apiKey,
                'Content-Type': 'application/json'
            }, 
            body: JSON.stringify({ input, model, parameters })
        });
        let respText = await resp.text();

        let respJson: any = {};
        try
        {
            respJson = JSON.parse(respText);
        }
        catch{}

        if (!respJson.output)
        {
            throw new NovelAiError("Failed to get valid response from NovelAI.", {
                cause: respText
            })
        }

        return respJson.output;
    }

    #parseSseEvent(event: string)
    {
        /*
            event: newToken
            id: 192
            data: {"token":" the","ptr":192,"final":false,"logprobs":{"chosen":[[[279],[-0.0011,0.0]]],"before":[[[279],[-0.0011,0.0]],[[264],[-7.0515,null]],[[198],[-9.05,null]],[[813],[-10.5009,null]],[[271],[-10.773,null]],[[832],[-11.7912,null]],[[14373],[-12.1158,null]],[[459],[-12.1696,null]],[[1022],[-12.2514,null]],[[1234],[-12.3947,null]]],"after":[[[279],[-0.0011,0.0]]]}}
        */
        let lines = event.split(/\r\n|\n/g);
        if (lines[0] == "event: newToken")
        {
            let data = lines[2].replace("data: ", "");
            let json = JSON.parse(data);
            return {
                token: json.token,
                final: json.final
            };
        }
    }

    async generateTextStreamed(input: string, model: NovelAiTextModel = "llama-3-erato-v1", options: TextGenOptions | undefined = undefined, callback: (chunk: string) => any): Promise<void>
    {
        let parameters: TextGenOptions | undefined = undefined;
        if (!options)
        {
            parameters = DefaultTextGenOptions
        }
        else
        {
            parameters = this.#mergeObjects<TextGenOptions>(
                                DefaultTextGenOptions, options);
        }

        const resp = await fetch('https://text.novelai.net/ai/generate-stream', {
            method: 'POST', 
            headers: {
                'Authorization': 'Bearer ' + this.#apiKey,
                'Content-Type': 'application/json'
            }, 
            body: JSON.stringify({ input, model, parameters })
        });

        let reader = resp.body!.getReader();

        while (true) {
            let data = await reader!.read();
            if (data.done) break;

            let dataStr = Buffer.from(data.value).toString("utf8");
            let event = this.#parseSseEvent(dataStr);

            if (!event) continue;
            if (event.final) break;

            await callback(event.token);
        }
        return;
    }
}

type TextPromptBuilderConstructorOption = {
    artist?: string,
    title?: string,
    tags?: string[],
    genre?: string[],
    style?: string[],
    writingQuality?: number
};

export class TextPromptBuilder
{
    #attg = ""
    #style = ""

    constructor(options: TextPromptBuilderConstructorOption)
    {
        this.#attg = "[ ";

        if (options.artist) this.#attg += `Artist: ${options.artist}; `;
        if (options.title) this.#attg += `Title: ${options.title}; `;
        if (options.tags) this.#attg += `Tags: ${options.tags.join(", ")}; `;
        if (options.genre) this.#attg += `Genre: ${options.genre.join(", ")}; `;

        this.#attg += "]"

        if (options.writingQuality) this.#attg += `[ S: ${options.writingQuality} ]`

        if (this.#attg == "[ ]") this.#attg = "";

        if (options.style) this.#style = `[ Style: ${options.style.join(", ")} ]`;
    }

    build(text: string, lines: string[] = []): string
    {
        if (!lines.length) lines = text.split(/\r\n|\n/g);

        if (this.#style != "")
        {
            let styleInsertLine = Math.max(0, lines.length - 3);
            if (styleInsertLine <= 0)
            {
                lines.unshift(this.#style);
            }
            else
            {
                let firstHalf = lines.slice(0, styleInsertLine);
                let secondHalf = lines.slice(styleInsertLine);
                firstHalf.push(this.#style);
                lines = firstHalf.concat(secondHalf);
            }
        }

        if (this.#attg != "") lines.unshift(this.#attg);
        lines.unshift("<|begin_of_text|>")
        return lines.join("\n");
    }
}

type ChatPromptBuilderConstructorOptions = {
    systemPrompt?: string,
    assistantName?: string,
    examples?: ChatEntry[]
};

type ChatEntry = {
    role: "system" | "assistant" | "user" | "sequence" | string,
    content: string,
    name?: string
}

export class ChatPromptBuilder
{
    #assistantName: string = "assistant"
    #sysPrompt: string = "You are a helpful assistant";
    #examples: ChatEntry[] = []

    constructor(options: ChatPromptBuilderConstructorOptions)
    {
        if (options.assistantName) this.#assistantName = options.assistantName;
        if (options.systemPrompt) this.#sysPrompt = options.systemPrompt;
        if (options.examples) this.#examples = options.examples;
    }

    build(entries: ChatEntry[])
    {
        let builder: string[] = ["<|begin_of_text|>"];

        for (let entry of this.#examples)
        {
            switch(entry.role)
            {
                case "assistant": 
                    builder.push(`<|start_header_id|>${this.#assistantName}<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "user":
                    builder.push(`<|start_header_id|>${entry.name ?? "user"}<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "system":
                    builder.push(`<|start_header_id|>system<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "sequence":
                    builder.push(entry.content)
                    break;
            }
        }

        if (this.#sysPrompt != "") builder.push(`<|start_header_id|>system<|end_header_id|>\n\n${this.#sysPrompt}\n<|eof_id|>`);

        for (let entry of entries)
        {
            switch(entry.role)
            {
                case "assistant": 
                    builder.push(`<|start_header_id|>${this.#assistantName}<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "user":
                    builder.push(`<|start_header_id|>${entry.name ?? "user"}<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "system":
                    builder.push(`<|start_header_id|>system<|end_header_id|>\n\n${entry.content}\n<|eof_id|>`);
                    break;
                case "sequence":
                    builder.push(entry.content)
                    break;
            }
        }

        builder.push(`<|start_header_id|>${this.#assistantName}<|end_header_id|>\n\n`);
        return builder.join("\n");
    }
}