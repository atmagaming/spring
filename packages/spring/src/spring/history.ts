import { FileClient, SyncedJsonFile } from "file-client";
import { maxHistorySize, paths } from "config";
import type { ChatHistory, ChatMessage } from "./state";
import type { MessageRole } from "./types";
import type { ChunkedMessage } from "utils";

export class History extends SyncedJsonFile<ChatHistory> {
    constructor(fileClient: FileClient) {
        super(fileClient, paths.history, []);
    }

    async addMessage(role: MessageRole, message: string | ChunkedMessage) {
        const content = typeof message === "string" ? message : await message.fullMessage;
        const v = this.value;
        v.push({ role: role === "user" ? "user" : "assistant", content });
        if (v.length > maxHistorySize) v.shift();
        this.value = v;
    }

    asString(selfName: string, userName: string) {
        return this.value.map((message) => this.formatHistoryMessage(message, selfName, userName)).join("\n\n");
    }

    private formatHistoryMessage(message: ChatMessage, selfName: string, userName: string) {
        const { role, content } = message;
        const name = role === "assistant" ? selfName : userName;
        return `${name}: ${content}`;
    }
}
