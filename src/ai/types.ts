import type { ChatModel } from "openai/resources/index.mjs";
import type { ChatHistory } from "spring/types";

export type ChunkOptions = "token" | "sentence" | "paragraph" | "logical";
export interface TextCompletionOptions {
    textModel?: ChatModel;
    systemMessage?: string;
    history?: ChatHistory;
}
