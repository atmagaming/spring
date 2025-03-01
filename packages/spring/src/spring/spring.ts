import { di } from "@elumixor/di";
import { all } from "@elumixor/frontils";
import { AI } from "ai";
import chalk from "chalk";
import { ChatBot, type BotMessage, type TextBotMessage } from "chat-bot";
import { FileClient, SyncedFile } from "file-client";
import { BehavioralCore } from "./behavioral-core";

// todo: I don't know why this class exists. I feel like it's not needed
export class Spring {
    private readonly chat = di.inject(ChatBot);
    private readonly ai = di.inject(AI);
    private readonly behavior;
    private readonly chatIdFile;

    constructor() {
        // todo: We can now remove this file client/server logic as we have prod env and separate prod bot
        const fileClient = new FileClient(import.meta.env.FILE_SERVER_URL);
        di.provide(FileClient, fileClient);

        this.behavior = new BehavioralCore();
        this.chatIdFile = new SyncedFile(fileClient, "./chat-id.txt", "text");

        // Register event handlers from the chat
        this.chat.commandReceived.subscribe((message) => this.onCommand(message));
        this.chat.textReceived.subscribe((message) => this.onUserMessage(message));
        this.chat.voiceReceived.subscribe(async (message) => {
            message.parsedText = await this.ai.voiceToText(await message.voice);
            this.onUserMessage(message as TextBotMessage);
        });
    }

    async wakeUp() {
        await this.chat.start();
        log.log(chalk.yellow("Spring: waking up"));
        await all(this.setUpChatId(), this.behavior.load());
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
        void this.behavior.handleUserMessage(message);
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

    private async setUpChatId() {
        const id = await this.chatIdFile.initialize();
        const chatID = Number(id.trim());
        log.log(`Communicating with the last chat ID ${chatID}`);
        this.chat.chatId = chatID;
    }
}
