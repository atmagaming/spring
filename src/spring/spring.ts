import { di } from "@elumixor/di";
import { AI } from "ai";
import chalk from "chalk";
import { ChatBot, type BotMessage, type TextBotMessage } from "chat-bot";
import { log } from "utils";
import { BehavioralCore } from "./behavioral-core";

// todo: I don't know why this class exists. I feel like it's not needed
export class Spring {
    private readonly chat = di.inject(ChatBot);
    private readonly ai = di.inject(AI);
    private readonly behavior;

    constructor() {
        this.behavior = new BehavioralCore();

        // Register event handlers from the chat
        this.chat.commandReceived.subscribe(this.wrap((message) => this.onCommand(message)));
        this.chat.textReceived.subscribe(this.wrap((message) => this.onUserMessage(message)));
        this.chat.voiceReceived.subscribe(
            this.wrap(async (message) => {
                message.parsedText = await this.ai.voiceToText(await message.voice);
                await this.onUserMessage(message as TextBotMessage);
            }),
        );
    }

    async wakeUp() {
        await this.chat.start();
        log.log(chalk.yellow("Spring: waking up"));
        await this.behavior.load();
        log.log(chalk.green("Spring: awake!"));
        await this.chat.sendText("(awake)");
    }

    async sleep() {
        await this.chat.sendText("(sleeping)");
        await this.chat.stop();
        log.log(chalk.green("Spring: went to sleep..."));
    }

    /* Handlers */

    /** This is the main part of execution */
    private onUserMessage(message: TextBotMessage) {
        log.log(`${chalk.cyan("User:")} ${message.text}`);
        return this.behavior.handleUserMessage(message);
    }

    /* Commands */

    private async onCommand({ command }: BotMessage) {
        log.log(chalk.yellow(`User issued command: ${command}`));

        switch (command) {
            case "ping":
                return this.chat.sendText("Pong!");
            case "history": {
                const { historyString } = this.behavior;
                if (historyString.trim() === "") return this.chat.sendText("History is empty.");
                return this.chat.sendText(this.behavior.historyString);
            }
            case "clearhistory":
            case "reset":
                return this.behavior.reset();
            case "systemMessage":
                return this.chat.sendText(this.behavior.systemMessage);
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
                if (error instanceof Error) {
                    msg = `Error occurred in Spring Core!\n\n${error.message}`;
                } else {
                    msg = "Error occurred in Spring Core";
                }

                log.error(msg);
                log.error(error);

                // Sent the error to the user
                await this.chat.sendText(msg);
            }
        }) as T;
    }
}
