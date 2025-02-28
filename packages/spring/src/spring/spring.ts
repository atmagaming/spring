import { di } from "@elumixor/di";
import { all } from "@elumixor/frontils";
import { AI } from "ai";
import chalk from "chalk";
import { ChatBot, type BotMessage, type TextBotMessage } from "chat-bot";
import { FileClient, SyncedFile } from "file-client";
import { ChunkedMessage, joinChunks } from "utils";
import { BehavioralCore } from "./behavioral-core";

export class Spring {
    private readonly chat = di.inject(ChatBot);
    private readonly aiModel = di.inject(AI);

    private readonly behavior;
    private readonly chatIdFile;

    constructor() {
        const fileClient = new FileClient(import.meta.env.FILE_SERVER_URL);
        di.provide(FileClient, fileClient);

        this.behavior = new BehavioralCore(this.aiModel);
        this.chatIdFile = new SyncedFile(fileClient, "./chat-id.txt", "text");

        // Register event handlers from the chat
        this.chat.commandReceived.subscribe((message) => this.onCommand(message));
        this.chat.textReceived.subscribe((message) => this.onUserMessage(message));
        this.chat.voiceReceived.subscribe(async (message) => {
            message.parsedText = await this.aiModel.voiceToText(await message.voice);
            this.onUserMessage(message as TextBotMessage);
        });

        // Register event handlers from the behavior
        this.behavior.sendMessageRequested.subscribe((text) => this.messageUser(text));
        this.behavior.sendFileRequested.subscribe(async (fileData) => void (await this.chat.sendFile(fileData)));
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
        void this.behavior.acceptMessage(message);
    }

    private async messageUser(text: string | PromiseLike<string> | ChunkedMessage) {
        const isChunked = text instanceof ChunkedMessage;
        if (!this.behavior.voicePreferred) {
            if (!isChunked) log.log(`${chalk.green("Spring:")} ${await text}`);
            else void text.fullMessage.then((message) => log.log(`${chalk.green("Spring:")} ${message}`));
            return this.chat.sendText(await text);
        }

        const mergedText = !isChunked ? await text : await joinChunks(text);
        const voiceBuffer = await this.aiModel.textToVoice(mergedText);
        return this.chat.sendVoice(voiceBuffer);
    }

    /* Commands */

    private async onCommand({ command }: BotMessage) {
        log.log(chalk.yellow(`User issued command: ${command}`));

        switch (command) {
            case "ping":
                await this.chat.sendText("Pong!");
                return;
            case "history":
                await this.chat.sendText(this.behavior.historyString);
                return;
            case "systemMessage":
                await this.chat.sendText(this.behavior.systemMessage);
                return;
            case "reset":
                await this.reset();
                return;
            case "shutdown":
                await this.sleep();
                await this.chat.stop();
                return;
            default:
                await this.chat.sendText("(unknown command)");
                return;
        }
    }

    private async reset() {
        await this.behavior.reset();
    }

    /* Utils */

    private async setUpChatId() {
        const id = await this.chatIdFile.initialize();
        const chatID = Number(id.trim());
        log.log(`Communicating with the last chat ID ${chatID}`);
        this.chat.chatId = chatID;
    }
}
