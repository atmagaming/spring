import { defaultTextOptions, defaultTranscriptionModel, defaultVoiceOptions } from "config";
import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam, ChatModel } from "openai/resources/index.mjs";
import type { ChatCompletionChunk } from "openai/src/resources/index.js";
import { ChunkedMessage } from "utils";
import { separationMessage } from "./separation-message";

type ChunkOptions = "token" | "sentence" | "paragraph" | "logical";

interface TextCompletionOptions {
    textModel?: ChatModel;
    systemMessage?: string;
    history?: { role: "assistant" | "user"; content: string }[];
}

interface IChatMessage {
    role: "assistant" | "user";
    content: string;
}

export class AiModel {
    private readonly client = new OpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });

    /* Main public API functions */

    textCompletion(prompt: string, options?: TextCompletionOptions): Promise<string>;
    textCompletion(prompt: string, options: TextCompletionOptions & { chunk: ChunkOptions }): ChunkedMessage;
    textCompletion(
        prompt: string,
        {
            textModel = defaultTextOptions.textModel,
            systemMessage,
            history = [],
            chunk,
        }: TextCompletionOptions & { chunk?: ChunkOptions } = {},
    ) {
        if (chunk === "logical") systemMessage = (systemMessage ?? "") + `\n${separationMessage}`;
        const messages = this.buildMessages(prompt, systemMessage, history);

        if (chunk === undefined) return this.simpleTextCompletion({ model: textModel, messages });

        // Otherwise, create a stream of completions
        const stream = this.chunkedTextCompletion({ model: textModel, messages, chunk });
        const chunked = new ChunkedMessage(stream);
        return chunked;
    }

    async textToVoice(text: string, options = defaultVoiceOptions) {
        const response = await this.client.audio.speech.create({ ...options, input: text });
        assert(response.body);
        return response.body;
    }

    async voiceToText(buffer: NodeJS.ReadableStream) {
        const response = await this.client.audio.transcriptions.create({
            model: defaultTranscriptionModel,
            file: await toFile(buffer, "audio.wav"),
            response_format: "text",
        });

        return response as unknown as string;
    }

    /* Text completion logic */

    private async simpleTextCompletion(options: { model: ChatModel; messages: ChatCompletionMessageParam[] }) {
        const result = await this.client.chat.completions.create(options);
        return result.choices[0].message.content;
    }

    private async *chunkedTextCompletion({
        model,
        messages,
        chunk,
    }: {
        model: ChatModel;
        messages: ChatCompletionMessageParam[];
        chunk: ChunkOptions;
    }): AsyncIterable<string> {
        // Create a stream of completions for chunked responses
        const stream = await this.client.chat.completions.create({ model, messages, stream: true });
        const stringStream = this.toStringStream(stream);

        if (chunk === "token") return yield* stringStream;
        if (chunk === "sentence") return yield* this.yieldRegexChunks(stringStream, /[.!?]\s/);
        if (chunk === "paragraph") return yield* this.yieldRegexChunks(stringStream, /\n\s*\n/);

        // Split by the <SPLIT> token
        return yield* this.yieldRegexChunks(stringStream, "<SPLIT>");
    }

    /* Low-level utils/helpers */

    private buildMessages(prompt: string, systemMessage?: string, history: IChatMessage[] = []) {
        return [
            ...(systemMessage ? [{ role: "system", content: systemMessage }] : []),
            ...history,
            { role: "user", content: prompt },
        ] as ChatCompletionMessageParam[];
    }

    async *yieldRegexChunks(stream: AsyncIterable<string>, delimiter: RegExp | string) {
        let messageStr = "";

        for await (const chunk of stream) {
            messageStr += chunk;

            if (typeof delimiter === "string") {
                // Split by the delimiter
                const split = messageStr.split(delimiter);
                for (let i = 0; i < split.length - 1; i++) yield split[i];
                messageStr = split[split.length - 1];
                continue;
            }

            let splitIndex;

            // Yield chunks based on the delimiter
            // Note that in messageStr can be multiple delimiters, and, hence, chunks
            while ((splitIndex = messageStr.search(delimiter)) !== -1) {
                messageStr.slice(0, splitIndex + 1).trim(); // yield the first part
                messageStr = messageStr.slice(splitIndex + 1).trim(); // keep the rest
            }
        }

        // Yield the remaining message
        if (messageStr) yield messageStr.trim();
    }

    private async *toStringStream(stream: AsyncIterable<ChatCompletionChunk>) {
        for await (const chunk of stream) yield chunk.choices[0]?.delta?.content ?? "";
    }
}
