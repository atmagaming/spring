import { di } from "@elumixor/di";
import { nonNull, nonNullAssert } from "@elumixor/frontils";
import { defaultTextOptions, defaultTranscriptionModel, defaultVoiceOptions } from "config";
import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import type { ChatCompletionMessageParam, ChatModel } from "openai/resources/index.mjs";
import type { ChatCompletionChunk } from "openai/src/resources/index.js";
import type { IAction } from "spring/actions";
import { ChunkedMessage } from "utils";
import { z } from "zod";
import { separationMessage } from "./separation-message";
import type { ChunkOptions, IChatMessage, TextCompletionOptions } from "./types";

@di.injectable
export class AI {
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

    async voiceToText(buffer: Buffer) {
        const response = await this.client.audio.transcriptions.create({
            model: defaultTranscriptionModel,
            file: await toFile(buffer, "audio.wav"),
            response_format: "text",
        });

        return response as unknown as string;
    }

    async selectAction<TActions extends Record<string, IAction>>(actions: TActions, history: IChatMessage[]) {
        const names = Object.keys(actions);
        const actionNameType = z.object({
            action: z.enum([names.first, ...names.skip(1)]),
        });

        const nameResponse = await this.client.beta.chat.completions.parse({
            model: defaultTextOptions.textModel,
            messages: [
                {
                    role: "system",
                    content: `
                    The user provides you with dialogue, ending with a user message.
                    You have a list of actions { name, intent }[] that you need to chose from.
                    You should output the name of the most appropriate action you need to take.

                    Here is the list of actions and intents:
                    ${Object.entries(actions)
                        .map(([name, { intent }]) => `${name}: ${intent}`)
                        .join("\n")}
                    `,
                },
                ...history,
            ],
            response_format: zodResponseFormat(actionNameType, "action"),
        });

        const { parsed: actionName, refusal: nameRefusal } = nameResponse.choices.first.message;

        if (nameRefusal) throw new Error(`Could not select action: ${nameRefusal}`);
        nonNullAssert(actionName);

        const action = actions[actionName.action];

        return nonNull(action);
    }

    async getActionArgs(action: IAction, history: IChatMessage[]) {
        const argumentsResponse = await this.client.beta.chat.completions.parse({
            model: defaultTextOptions.textModel,
            messages: [
                {
                    role: "system",
                    content: `
                    Given user's message, fill in arguments values, for the following action:

                    Action Intent: ${action.intent}
                    Additional instructions:\n${action.additionalInstructions?.map((s, i) => `${i + 1}. ${s}`).join("\n")}
                    `,
                },
                ...history,
            ],
            response_format: zodResponseFormat(action.args, "action"),
        });

        const { parsed: args, refusal: argsRefusal } = argumentsResponse.choices.first.message;

        if (argsRefusal) throw new Error(`Could not select arguments: ${argsRefusal}`);
        return nonNull(args);
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
