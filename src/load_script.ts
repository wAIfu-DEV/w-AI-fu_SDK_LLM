import * as path from "path"
import * as fs from "fs/promises"
import { InstallNpmRequirements } from "./install_npm_req";
import { state } from "./global_state";


export async function LoadLlmScript(dirPath: string, llmName: string): Promise<any | undefined>
{
    // Check for existence of directory
    try
    {
        await fs.access(dirPath)
    }
    catch(e)
    {
        console.error("[ERROR] Failed to find directory at path:", dirPath);
        return undefined;
    }

    // Check for existence of npm_requirements.txt
    let hasNpmRequirements = false;
    const npmReqPath = path.join(dirPath, "npm_requirements.txt");
    try
    {
        await fs.access(npmReqPath);
        hasNpmRequirements = true;
    }
    catch{}

    if (hasNpmRequirements)
    {
        await InstallNpmRequirements(npmReqPath, llmName);
    }

    // Check for existence of pip_requirements.txt
    let hasPipRequirements = false;
    const pipReqPath = path.join(dirPath, "pip_requirements.txt");
    try
    {
        await fs.access(pipReqPath);
        hasPipRequirements = true;
    }
    catch{}

    // TODO: install pip requirements

    // Check for existence of index.ts
    const indexPath = path.join(dirPath, "index.ts");
    try
    {
        await fs.access(indexPath);
    }
    catch(e)
    {
        console.error("[ERROR] Failed to find index javascript file at path:", indexPath);
        return undefined;
    }

    state.requirePath = indexPath
    return require(indexPath);
}