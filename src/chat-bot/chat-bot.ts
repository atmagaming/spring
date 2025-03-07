import { di } from "@elumixor/di";
import { EventEmitter } from "@elumixor/frontils";
import { Bot, BotError, InputFile } from "grammy";
import type { ParseMode, ReactionType } from "grammy/types";
import {
    BotMessage,
    type CommandBotMessage,
    type PhotoBotMessage,
    type TextBotMessage,
    type VoiceBotMessage,
} from "./bot-message";
import type { ISendFileData, TextResponse } from "./types";
import { ChunkedMessage, log } from "utils";
import { Readable } from "stream";

@di.injectable
export class ChatBot {
    readonly textReceived = new EventEmitter<TextBotMessage>();
    readonly voiceReceived = new EventEmitter<VoiceBotMessage>();
    readonly photoReceived = new EventEmitter<PhotoBotMessage>();
    readonly commandReceived = new EventEmitter<CommandBotMessage>();
    readonly reactionsChanged = new EventEmitter<BotMessage>();

    private readonly bot = new Bot(import.meta.env.BOT_TOKEN);

    private readonly chatId = import.meta.env.BOT_CHAT_ID;

    constructor() {
        this.bot.on("message", (ctx) => {
            const message = new BotMessage(ctx);
            if (message.hasCommand()) this.commandReceived.emit(message);
            else if (message.hasVoice()) this.voiceReceived.emit(message);
            else if (message.hasText()) this.textReceived.emit(message);
        });
        this.bot.on("message_reaction", (ctx) => this.reactionsChanged.emit(new BotMessage(ctx)));
        this.bot.catch((err) => this.onError(err));
    }

    start() {
        void this.bot.start({
            allowed_updates: ["message", "message_reaction", "message_reaction_count", "edited_message"], // todo: react to message edit...
        });
        log.info("Bot is up and running!");
        return Promise.resolve();
    }

    async stop() {
        log.info("Bot shutting down...");
        await this.bot.stop();
    }

    /* Commands for sending messages to the user */

    async sendText(text: TextResponse, parse_mode?: ParseMode) {
        // Send chunks recursively
        if (text instanceof ChunkedMessage) for await (const chunk of text) await this.sendText(chunk);
        else await this.bot.api.sendMessage(this.chatId, await text, { parse_mode });
    }

    async sendVoice(voice: ReadableStream) {
        await this.bot.api.sendVoice(this.chatId, new InputFile(voice));
    }

    async sendStatus(status: "typing" | "record_voice") {
        await this.bot.api.sendChatAction(this.chatId, status);
    }

    async sendReaction(messageId: number, reaction: ReactionType) {
        await this.bot.api.setMessageReaction(this.chatId, messageId, [reaction]);
    }

    sendFile(file: ISendFileData & { caption?: string; parse_mode?: ParseMode }) {
        return this.bot.api.sendDocument(this.chatId, new InputFile(Readable.from(file.buffer), file.fileName), {
            caption: file.caption,
            parse_mode: file.parse_mode,
        });
    }

    private async onError(err: BotError) {
        log.error("Error occurred in the bot:");
        log.error(err);

        // Sent the error to the user
        await this.sendText("Something went wrong. Please check the logs.");
    }
}
