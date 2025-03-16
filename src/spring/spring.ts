import { all } from "@elumixor/frontils";
import { AI } from "ai";
import chalk from "chalk";
import { ChatBot, type BotMessage, type TextBotMessage } from "chat-bot";
import { Apis, Databases } from "integrations/google";
import { log } from "utils";
import { agreementAction } from "./actions/agreement";
import { databasesActions } from "./actions/databases";
import { listPeopleAction } from "./actions/list-people";
import { parsePassportAction } from "./actions/parse-passport";
import { respondAction } from "./actions/respond";
import { signAction } from "./actions/sign";
import { Core } from "./core";

// todo: I don't know why this class exists. I feel like it's not needed
export class Spring {
    private readonly ai = new AI();
    private readonly chat = new ChatBot();
    private readonly apis = new Apis();
    private readonly core;
    private readonly databases;

    constructor() {
        this.databases = new Databases();
        this.core = new Core();

        // Register event handlers from the chat
        this.chat.commandReceived.subscribe(this.wrap((message) => this.onCommand(message)));
        this.chat.textReceived.subscribe(this.wrap((message) => this.onUserMessage(message)));
        this.chat.voiceReceived.subscribe(
            this.wrap(async (message) => {
                message.parsedText = await this.ai.voiceToText(await message.voice);
                await this.onUserMessage(message as TextBotMessage);
            }),
        );

        this.core.actions.push(
            agreementAction(),
            listPeopleAction(),
            databasesActions(),
            signAction(),
            parsePassportAction(),
            respondAction(),
        );
    }

    async wakeUp() {
        this.chat.start();
        log.chat = this.chat;
        log.info("Waking up...");
        await this.apis.init();
        await all(this.databases.init(), this.core.load());
        log.info("Ready!");
    }

    async sleep() {
        log.info("(sleeping)");
        await this.chat.stop();
    }

    /* Handlers */

    /** This is the main part of execution */
    private onUserMessage(message: TextBotMessage) {
        log.debug(`${chalk.cyan("User:")} ${message.text}`);
        return this.core.onUserMessage(message);
    }

    /* Commands */

    private async onCommand({ command }: BotMessage) {
        log.debug(chalk.yellow(`User issued command: ${command}`));

        switch (command) {
            case "ping":
                return this.chat.sendText("Pong!");
            case "history": {
                const { historyString } = this.core;
                if (historyString.trim() === "") return this.chat.sendText("History is empty.");
                return this.chat.sendText(this.core.historyString);
            }
            case "clearhistory":
            case "reset":
                return this.core.reset();
            case "systemMessage":
                return this.chat.sendText(this.core.systemMessage);
            case "shutdown":
                await this.sleep();
                await this.chat.stop();
                return;
            default:
                return this.chat.sendText("(unknown command)");
        }
    }

    private wrap<T extends (...args: never[]) => unknown>(fn: T): T {
        return (async (...args: Parameters<T>) => {
            try {
                const result = await fn(...args);
                return result;
            } catch (error) {
                let msg;

                if (error instanceof Error) msg = `Error occurred in Spring Core!\n\n${error.message}`;
                else msg = "Error occurred in Spring Core";

                log.error(msg);
            }
        }) as T;
    }
}
