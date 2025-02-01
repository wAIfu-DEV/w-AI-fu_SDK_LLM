import { LargeLanguageModel } from "./LlmInterface";

export type GlobalState = {
    requirePath: string | undefined,
    loadedProviderName: string | undefined,
    largeLanguageModel: LargeLanguageModel | undefined,
}

export let state: GlobalState = {
    requirePath: undefined,
    loadedProviderName: undefined,
    largeLanguageModel: undefined,
}