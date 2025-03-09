import type { ISendFileData, TextResponse } from "chat-bot";
import type { ParseMode } from "grammy/types";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
    role: MessageRole;
    content: string;
}

export type ChatHistory = readonly ChatMessage[];

export interface ResponseData {
    file?: ISendFileData;
    text?: TextResponse;
    ignoreHistory?: boolean;
    parse_mode?: ParseMode;
}
