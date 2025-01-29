import * as path from "path";
import * as fs from "fs/promises"

import { state } from "./global_state";
import { LoadLlmScript } from "./load_script";
import { LargeLanguageModel, VerifyInterfaceAdherence } from "./LlmInterface";
import { LLM_GEN_ERR } from "./types";



export async function LoadModel(modelName: string, loadRequest: any): Promise<LLM_GEN_ERR>
{
    // Check if model exists
    const modelPath = path.join("models", modelName);

    try
    {
        await fs.access(modelPath)
    }
    catch(e)
    {
        console.error("[ERROR] Failed to find model:", modelName);
        return LLM_GEN_ERR.INVALID_MODEL;
    }

    let tempModel = await LoadLlmScript(modelPath, modelName);

    if (!tempModel)
    {
        console.error("[ERROR] Failed to load model:", modelName);
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (tempModel.Model == undefined)
    {
        console.error("[ERROR] Index file of LLM", modelName, "does not export a \"Model\".");
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (VerifyInterfaceAdherence(tempModel.Model, modelName))
    {
        console.error("[ERROR] Loaded model", modelName, "does not adhere to the LargeLanguageModel interface.");
        return LLM_GEN_ERR.UNEXPECTED;
    }

    if (state.largeLanguageModel != undefined)
    {
        await state.largeLanguageModel.Free();
    }

    state.largeLanguageModel = tempModel.Model as LargeLanguageModel;
    return await state.largeLanguageModel.Init(loadRequest);
}