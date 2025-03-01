import { di } from "@elumixor/di";
import type { TextResponse } from "chat-bot";
import { maxHistorySize, paths } from "config";
import { FileClient, SyncedJsonFile } from "file-client";
import { fullMessage } from "utils";
import type { ChatHistory, ChatMessage } from "./state";
import type { MessageRole } from "./types";

export class History extends SyncedJsonFile<ChatHistory> {
    constructor() {
        super(di.inject(FileClient), paths.history, []);
    }

    async addMessage(role: MessageRole, message: TextResponse) {
        const content = await fullMessage(message);
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
