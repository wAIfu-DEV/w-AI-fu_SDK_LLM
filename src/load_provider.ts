import * as path from "path";
import * as fs from "fs/promises"

import { state } from "./global_state";
import { LoadLlmScript } from "./load_script";
import { LargeLanguageModel, VerifyInterfaceAdherence } from "./LlmInterface";
import { LLM_GEN_ERR } from "./types";



export async function LoadProvider(modelProvider: string, loadRequest: any): Promise<LLM_GEN_ERR>
{
    // Check if model exists
    const modelPath = path.join(process.cwd(), "providers", modelProvider);

    try
    {
        await fs.access(modelPath)
    }
    catch(e)
    {
        console.error("[ERROR] Failed to find provider:", modelProvider);
        return LLM_GEN_ERR.INVALID_PROVIDER;
    }

    let tempModel = await LoadLlmScript(modelPath, modelProvider);

    if (!tempModel)
    {
        console.error("[ERROR] Failed to load provider:", modelProvider);
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (tempModel.Model == undefined)
    {
        console.error("[ERROR] Index file of provider", modelProvider, "does not export a field \"llm\" adhering to the LargeLanguageModel interface.");
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (!VerifyInterfaceAdherence(tempModel.Model, modelProvider))
    {
        console.error("[ERROR] Loaded provider", modelProvider, "does not adhere to the LargeLanguageModel interface.");
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (state.largeLanguageModel != undefined)
    {
        await state.largeLanguageModel.Free();
    }

    state.largeLanguageModel = tempModel.Model as LargeLanguageModel;
    return await state.largeLanguageModel.Init(loadRequest);
}