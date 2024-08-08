import { all } from "@elumixor/frontils";
import { paths } from "config";
import { History } from "./history";
import { FileClient, SyncedFile } from "@spring/file-client";
import { di } from "@elumixor/di";
import { defaultBehavior, defaultIdentity, defaultRules } from "./defaults";

export interface ChatMessage {
    role: "assistant" | "user";
    content: string;
}

export type ChatHistory = ChatMessage[];

export class State {
    private readonly fileClient = di.inject(FileClient);
    readonly history = new History(this.fileClient);
    private readonly identityFile = new SyncedFile(this.fileClient, paths.system.identity, "text", {
        defaultValue: defaultIdentity,
    });
    private readonly behaviorFile = new SyncedFile(this.fileClient, paths.system.behavior, "text", {
        defaultValue: defaultBehavior,
    });
    private readonly rulesFile = new SyncedFile(this.fileClient, paths.system.rules, "text", {
        defaultValue: defaultRules,
    });

    get systemMessage() {
        return `${this.identityFile.value}\n${this.behaviorFile.value}\n${this.rulesFile.value}`;
    }

    /* General functions */

    async load() {
        await all(
            this.identityFile.initialize(),
            this.behaviorFile.initialize(),
            this.rulesFile.initialize(),
            this.history.initialize(),
        );

        log("State loaded");
        log(`Identity:\n${this.identityFile.value}`);
        log(`Behavior:\n${this.behaviorFile.value}`);
        log(`Rules:\n${this.rulesFile.value}`);
    }

    async reset() {
        await all(
            this.identityFile.update(""),
            this.behaviorFile.update(""),
            this.behaviorFile.update(""),
            this.rulesFile.update(""),
            this.history.update([]),
        );
    }
}
