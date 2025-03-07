export type MessageRole = "user" | "assistant";

export interface ChatMessage {
    role: MessageRole;
    content: string;
}

export type ChatHistory = readonly ChatMessage[];
