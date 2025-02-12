import { AsyncEventEmitter } from "@elumixor/frontils";
import { Bot, BotError, Context, InputFile } from "grammy";
import type { ReactionType, ReactionTypeEmoji } from "grammy/types";
import fetch from "node-fetch";

type Emojis = ReactionTypeEmoji["emoji"][];
export class ChatBot {
    readonly textReceived = new AsyncEventEmitter<{ ctx: Context; text: string }>();
    readonly voiceReceived = new AsyncEventEmitter<{ ctx: Context; buffer: NodeJS.ReadableStream }>();
    readonly reactionsChanged = new AsyncEventEmitter<{ ctx: Context; emojiAdded: Emojis; emojiRemoved: Emojis }>();
    readonly commandReceived = new AsyncEventEmitter<{ ctx: Context; command: string }>();

    private readonly bot = new Bot(import.meta.env.BOT_TOKEN);
    private readonly commandsMap = new Map<string, (command: string) => Promise<void>>();

    chatId?: undefined | number;

    constructor() {
        this.bot.on("message:text", (ctx) => {
            const { text } = ctx.message;
            const maybeCommand = this.matchCommand(text);
            if (maybeCommand !== undefined) return this.onCommand(ctx, maybeCommand);
            return this.onText(ctx, text);
        });
        this.bot.on("message:voice", (ctx) => this.onVoice(ctx));
        this.bot.on("message_reaction", (ctx) => this.onReaction(ctx));
        this.bot.catch((err) => this.onError(err));
    }

    start() {
        void this.bot.start({
            allowed_updates: ["message", "message_reaction", "message_reaction_count", "edited_message"], // todo: react to message edit...
        });
        log("Bot is up and running!");
        return Promise.resolve();
    }

    async stop() {
        log("Bot shutting down...");
        await this.bot.stop();
    }

    /* Commands for sending messages to the user */

    async sendText(text: string | AsyncIterable<string>) {
        assert(this.chatId !== undefined, "Chat ID is not set.");

        // Send chunks recursively
        if (typeof text !== "string") {
            for await (const chunk of text) await this.sendText(chunk);
            return;
        }

        // TODO: markdown just does not work...
        return this.bot.api.sendMessage(this.chatId, text);

        // // If not markdown, send as is
        // const isMarkdown = await isValidMarkdown(text);
        // log("Is markdown:", isMarkdown);

        // if (!isMarkdown) return this.bot.api.sendMessage(this.chatId, text);

        // // Otherwise escape special characters
        // log("Sending markdown text...");
        // log(text);

        // const escapedText = this.escapeText(text);
        // log("Escaped\n\n", escapedText);

        // await this.bot.api.sendMessage(this.chatId, escapedText, { parse_mode: "MarkdownV2" });
    }

    async sendVoice(voice: ReadableStream) {
        assert(this.chatId !== undefined, "Chat ID is not set.");
        await this.bot.api.sendVoice(this.chatId, new InputFile(voice));
    }

    async sendStatus(status: "typing" | "record_voice") {
        assert(this.chatId !== undefined, "Chat ID is not set.");
        await this.bot.api.sendChatAction(this.chatId, status);
    }

    async sendReaction(messageId: number, reaction: ReactionType) {
        assert(this.chatId !== undefined, "Chat ID is not set.");
        await this.bot.api.setMessageReaction(this.chatId, messageId, [reaction]);
    }

    private onText(ctx: Context, text: string) {
        return this.textReceived.emit({ ctx, text });
    }

    /* Handlers */

    private onCommand(ctx: Context, command: string) {
        // Try to match known commands, specific to the bot
        const handler = this.commandsMap.get(command);
        if (handler) return handler(command);
        return this.commandReceived.emit({ ctx, command });
    }

    private async onVoice(ctx: Context) {
        assert(ctx.message && ctx.message.voice);

        const { file_id } = ctx.message.voice;
        const file = await ctx.api.getFile(file_id);
        assert(file);

        const filePath = file.file_path;
        assert(filePath);

        const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
        const response = await fetch(fileUrl);
        const buffer = response.body;

        assert(buffer !== null);
        return this.voiceReceived.emit({ ctx, buffer });
    }

    private onReaction(ctx: Context) {
        const { emojiAdded, emojiRemoved } = ctx.reactions();
        return this.reactionsChanged.emit({ ctx, emojiAdded, emojiRemoved });
    }

    /* Error handler */

    private async onError(err: BotError) {
        log("Error occurred in the bot:");
        log(err);

        // Sent the error to the user
        await this.sendText("Something went wrong. Please check the logs.");
    }

    /* Commands that are handled by the chat bot itself */

    /* Utilities */

    private matchCommand(text: string) {
        // Commands should start with a slash and contain only a single word
        const trimmed = text.trim();
        const commandRegex = /^\/[a-zA-Z]+$/;
        return commandRegex.test(trimmed) ? trimmed.slice(1) : undefined;
    }

    /** Escape text for MarkdownV2 */
    private escapeText(text: string) {
        const specialChars = /([*_[\]()~>#+\-=|{}.!])/g;
        return text.replace(specialChars, "\\$1");
    }
}
