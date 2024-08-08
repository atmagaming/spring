import { FileClient, SyncedJsonFile } from "@spring/file-client";
import { maxHistorySize, paths } from "config";
import type { ChatHistory, ChatMessage } from "./state";

export class History extends SyncedJsonFile<ChatHistory> {
    constructor(fileClient: FileClient) {
        super(fileClient, paths.history, []);
    }

    addMessage(role: "user" | "self", content: string) {
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
