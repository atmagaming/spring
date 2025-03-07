import { fetch } from "bun";
import type { Context } from "grammy";
import type { IFileData } from "./types";
import { nonNull } from "@elumixor/frontils";

export class BotMessage {
    parsedText?: string;

    constructor(private readonly ctx: Context) {}

    get text() {
        const { text, caption } = this.ctx.msg ?? {};
        return text ?? caption ?? this.parsedText;
    }

    get voice() {
        const id = this.ctx.msg?.voice?.file_id;
        return id ? this.getFile(id) : Promise.resolve(undefined);
    }

    get photo() {
        const ids = this.ctx.msg?.photo?.map((p) => p.file_id);
        return ids ? this.getFile(ids.last) : Promise.resolve(undefined);
    }

    get emoji() {
        const { emoji, emojiAdded, emojiRemoved } = this.ctx.reactions();

        return {
            current: emoji,
            added: emojiAdded,
            removed: emojiRemoved,
        };
    }

    get command() {
        const { text } = this;
        if (!text) return;

        // Commands should start with a slash and contain only a single word
        const trimmed = text.trim();
        const commandRegex = /^\/[a-zA-Z]+$/;
        return commandRegex.test(trimmed) ? trimmed.slice(1) : undefined;
    }

    hasText(): this is TextBotMessage {
        return this.text !== undefined;
    }

    hasVoice(): this is VoiceBotMessage {
        return this.ctx.msg?.voice !== undefined;
    }

    hasCommand(): this is CommandBotMessage {
        return this.command !== undefined;
    }

    hasPhoto(): this is PhotoBotMessage {
        return this.ctx.msg?.photo !== undefined;
    }

    private async getFile(fileId: string) {
        const file = await this.ctx.api.getFile(fileId);

        const filePath = nonNull(file.file_path);
        const fileUrl = `https://api.telegram.org/file/bot${import.meta.env.BOT_TOKEN}/${filePath}`;
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        return {
            id: fileId,
            buffer,
            name: filePath,
        } satisfies IFileData;
    }
}
export type TextBotMessage = BotMessage & { text: string };
export type VoiceBotMessage = BotMessage & { voice: Promise<Buffer> };
export type PhotoBotMessage = BotMessage & { photo: Promise<Buffer> };
export type CommandBotMessage = BotMessage & { command: string };
