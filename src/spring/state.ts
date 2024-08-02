import { all } from "@elumixor/frontils";
import { maxHistorySize, paths } from "config";
import type { JSONArray } from "types-json";
import { readFile, readJSON, writeFile, writeJSON } from "utils";

export interface ChatMessage {
    role: "assistant" | "user";
    content: string;
}

export type ChatHistory = ChatMessage[];

export class State {
    selfName = "Spring";
    userName = "User";

    private _history?: ChatHistory;
    private identity?: string;
    private behavior?: string;
    private rules?: string;
    private historyWritePromise = Promise.resolve();

    get systemMessage() {
        return `${this.identity ?? ""}\n${this.behavior ?? ""}\n${this.rules ?? ""}`;
    }

    get history() {
        return this._history;
    }

    get historyString() {
        return this._history?.map((message) => this.formatHistoryMessage(message)).join("\n\n") ?? "(history empty)";
    }

    /* General functions */

    async load() {
        const [history, identity, behavior, rules] = await all(
            readJSON<ChatHistory>(paths.history),
            readFile(paths.system.identity),
            readFile(paths.system.behavior),
            readFile(paths.system.rules),
        );

        if (history !== undefined) this._history = history;
        if (identity !== undefined) this.identity = identity;
        if (behavior !== undefined) this.behavior = behavior;
        if (rules !== undefined) this.rules = rules;
    }

    async reset() {
        this._history = [];
        this.identity = undefined;
        this.behavior = undefined;
        this.rules = undefined;
        await this.save();
    }

    async save() {
        this.saveHistory();

        await all(
            this.historyWritePromise,
            writeFile(paths.system.identity, this.identity),
            writeFile(paths.system.behavior, this.behavior),
            writeFile(paths.system.rules, this.rules),
        );
    }

    /* History modification */

    addUserMessage(text: string) {
        if (!this._history) this._history = [];
        this._history.push({ role: "user", content: text });
        this.trimHistory();
        this.saveHistory();
    }

    addSelfMessage(text: string) {
        if (!this._history) this._history = [];
        this._history.push({ role: "assistant", content: text });
        this.trimHistory();
        this.saveHistory();
    }

    /* Low-level methods */

    private trimHistory() {
        if (this._history && this._history.length > maxHistorySize) this._history = this._history.slice(-100);
    }

    private saveHistory() {
        this.historyWritePromise = this.historyWritePromise.then(
            async () => await writeJSON(paths.history, this._history as unknown as JSONArray),
        );
    }

    private formatHistoryMessage(message: ChatMessage) {
        const { role, content } = message;
        const name = role === "assistant" ? this.selfName : this.userName;
        return `${name}: ${content}`;
    }
}
