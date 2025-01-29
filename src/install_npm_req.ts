import * as fs from "fs/promises"
import * as cproc from "child_process"

export async function InstallNpmRequirements(reqPath: string, llmName: string): Promise<void>
{
    console.log("[LOG] Checking npm dependencies for LLM:", llmName);

    // Check for currently installed packages
    try
    {
        var installedDepsResp = cproc.spawnSync("npm", ["list", "--depth=0", "--json"]);
    }
    catch
    {
        console.error("[ERROR] Failed to get currently installed npm packages.");
        process.exit(1);
    }

    if (installedDepsResp.error)
    {
        console.error("[ERROR] Error when trying to get currently installed npm packages.");
        process.exit(1);
    }

    // Parse output json
    try
    {
        var installedDepsJson = JSON.parse(installedDepsResp.stdout.toString("utf8"));
    }
    catch
    {
        console.error("[ERROR] Failed to parse currently installed npm packages.");
        process.exit(1);
    }

    // Read requirements file
    try
    {
        var depsStr = await fs.readFile(reqPath, { encoding: "utf8" });
    }
    catch
    {
        console.error("[ERROR] Failed to read npm requirements file.");
        process.exit(1);
    }

    const installedDeps: string[] = [];

    for (let [key, _] of Object.entries(installedDepsJson["dependencies"]))
    {
        installedDeps.push(key);
    }

    const lines: string[] = depsStr.split(/\r\n|\n/g);

    for (let line of lines)
    {
        if (line.trim() == "") continue;

        let atIdx = line.lastIndexOf("@");

        if (atIdx == -1)
        {
            console.error("[ERROR] Failed to parse npm requirements file.");
            console.error("[ERROR] Each lines must have format:");
            console.error("[ERROR] <npm package name>@<version>");
            process.exit(1);
        }

        let packageName = line.substring(0, atIdx);
        let packageVersion = line.substring(atIdx + 1);

        if (installedDeps.includes(packageName))
        {
            console.log(`[LOG] Npm package ${packageName} is already installed.`);
            continue;
        }

        var installResp = cproc.spawnSync("npm", ["install", `${packageName}@${packageVersion}`, "--save-dev"]);
        
        if (installResp.error)
        {
            console.error("[ERROR] Error when trying to install npm package:", packageName, packageVersion);
            process.exit(1);
        }
    }
    console.log("[LOG] Finished handling npm dependencies for LLM:", llmName);
}