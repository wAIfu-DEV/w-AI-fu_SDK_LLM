import { LargeLanguageModel } from "./LlmInterface";

export type GlobalState = {
    loadedProviderName: string | undefined,
    largeLanguageModel: LargeLanguageModel | undefined,
}

export let state: GlobalState = {
    loadedProviderName: undefined,
    largeLanguageModel: undefined,
}