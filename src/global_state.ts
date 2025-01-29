import { LargeLanguageModel } from "./LlmInterface";

export type GlobalState = {
    loadedModelName: string | undefined,
    largeLanguageModel: LargeLanguageModel | undefined,
}

export let state: GlobalState = {
    loadedModelName: undefined,
    largeLanguageModel: undefined,
}