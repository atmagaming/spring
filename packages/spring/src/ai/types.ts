import type { ChatModel } from "openai/resources/index.mjs";

export type ChunkOptions = "token" | "sentence" | "paragraph" | "logical";
export interface TextCompletionOptions {
    textModel?: ChatModel;
    systemMessage?: string;
    history?: { role: "assistant" | "user"; content: string }[];
}
export interface IChatMessage {
    role: "assistant" | "user";
    content: string;
}
