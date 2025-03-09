import type { TextResponse } from "chat-bot";
import { maxHistorySize, paths } from "config";
import { exists } from "fs/promises";
import { fullMessage, readJSON, writeJSON } from "utils";
import type { ChatHistory, ChatMessage, MessageRole } from "../types";
import { di } from "@elumixor/di";

@di.injectable
export class History {
    private _value: ChatMessage[] = [];
    private readonly selfName: MessageRole = "assistant";
    private readonly userName: MessageRole = "user";

    get value() {
        return this._value as ChatHistory;
    }

    async load() {
        if (await exists(paths.history)) this._value = await readJSON(paths.history);
    }

    update(value: ChatHistory) {
        this._value = [...value];
        return this.save();
    }

    async addMessage(role: MessageRole, message: TextResponse) {
        const content = await fullMessage(message);

        const { _value: value } = this;
        value.push({ role: role === "user" ? "user" : "assistant", content });

        if (value.length > maxHistorySize) value.shift();
        return this.save();
    }

    toString() {
        return this._value.map((message) => this.formatMessage(message)).join("\n\n");
    }

    private formatMessage(message: ChatMessage) {
        const { role, content } = message;
        const name = role === "assistant" ? this.selfName : this.userName;
        return `${name}: ${content}`;
    }

    private save() {
        return writeJSON(paths.history, this._value);
    }
}
