import { di } from "@elumixor/di";
import { nonNull } from "@elumixor/frontils";
import { defaultTextOptions, defaultTranscriptionModel, defaultVoiceOptions } from "config";
import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import type { ChatCompletionMessageParam, ChatModel } from "openai/resources/index.mjs";
import type { ChatCompletionChunk } from "openai/src/resources/index.js";
import type { IAction } from "spring/actions";
import type { ChatHistory } from "spring/types";
import { ChunkedMessage, log } from "utils";
import { z } from "zod";
import type { ChunkOptions, TextCompletionOptions } from "./types";

export type ResponseOf<T> = Promise<{ response: undefined; answerKnown: false } | { response: T; answerKnown: true }>;
export type ResponseWithQuestion<T> = Promise<
    | { response: undefined; answerKnown: false; question?: string }
    | { response: T; answerKnown: true; question: undefined }
>;

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
        const messages = this.buildMessages(prompt, systemMessage, history);

        if (chunk === undefined) return this.simpleTextCompletion({ model: textModel, messages });

        // Otherwise, create a stream of completions
        const stream = this.chunkedTextCompletion({ model: textModel, messages, chunk });
        const chunked = new ChunkedMessage(stream);
        return chunked;
    }

    async textToVoice(text: string, options = defaultVoiceOptions) {
        const response = await this.client.audio.speech.create({ ...options, input: text });
        return nonNull(response.body);
    }

    async voiceToText(buffer: Buffer) {
        const response = await this.client.audio.transcriptions.create({
            model: defaultTranscriptionModel,
            file: await toFile(buffer, "audio.wav"),
            response_format: "text",
        });

        return response as unknown as string;
    }

    // Returns the index of the option, for convenience
    async selectOption({
        options,
        history,
        systemMessage,
        resultName = "option",
    }: {
        options: { name: string; description: string }[];
        history: ChatHistory;
        systemMessage: string;
        resultName?: string;
    }) {
        const names = options.map((option) => option.name);
        const resultFormat = z.object({ [resultName]: z.enum([names.first, ...names.skip(1)]) });

        const nameResponse = await this.client.beta.chat.completions.parse({
            model: defaultTextOptions.textModel,
            messages: [...history, { role: "system", content: systemMessage }],
            response_format: zodResponseFormat(resultFormat, resultName),
        });

        const { parsed, refusal } = nameResponse.choices.first.message;

        if (refusal !== null || parsed === null) return undefined;

        const optionName = parsed[resultName];
        const index = options.findIndex((option) => option.name === optionName);
        return index === -1 ? undefined : index;
    }

    async selectAction<T extends Record<string, IAction>>(actions: T, history: ChatHistory) {
        const entries = Object.entries(actions);
        const names = entries.map(([name]) => name);
        const question = `
            What's the most relevant action to take?

            Here is the list of actions and intents:
            ${entries.map(([name, { intent }]) => `${name}: ${intent}`).join("\n")}
            `;

        const result = await this.getAnswer({
            history,
            question,
            concise: true,
            responseType: z.enum([names.first, ...names.skip(1)]),
            prefixQuestion: false,
        });

        log.info("Selected action:", result);

        if (!result.answerKnown) return undefined;
        const actionName = result.response as keyof T;
        return actions[actionName];
    }

    async getAnswer<T extends z.ZodType>(options: {
        history: ChatHistory;
        question: string;
        concise?: boolean;
        guess?: boolean;
        responseType: T;
        prefixQuestion?: boolean;
    }): ResponseOf<z.infer<T>>;
    async getAnswer(options: {
        history: ChatHistory;
        question: string;
        concise?: boolean;
        guess?: boolean;
        prefixQuestion?: boolean;
    }): ResponseOf<string>;
    async getAnswer<T extends z.ZodType>(options: {
        history: ChatHistory;
        question: string;
        concise?: boolean;
        responseType: T;
        notAvailable: "ask";
        prefixQuestion?: boolean;
    }): ResponseWithQuestion<z.infer<T>>;
    async getAnswer(options: {
        history: ChatHistory;
        question: string;
        concise?: boolean;
        notAvailable: "ask";
        prefixQuestion?: boolean;
    }): ResponseWithQuestion<string>;
    async getAnswer<T extends z.ZodType>({
        history,
        question,
        concise = false,
        guess = false,
        prefixQuestion = true,
        responseType = z.string() as unknown as T,
        notAvailable,
    }: {
        history: ChatHistory;
        question: string;
        concise?: boolean;
        guess?: boolean;
        prefixQuestion?: boolean;
        responseType?: T;
        notAvailable?: "ask";
    }) {
        let systemMessage = "";
        if (prefixQuestion) systemMessage += `Given this chat history, answer the following question:\n\n`;
        systemMessage += question;
        if (guess) systemMessage += "\n\nIf you don't know the answer, guess it. Don't reply that you don't know.";
        if (notAvailable === "ask") {
            systemMessage +=
                "\n\nIf you don't know the answer, respond with a message asking for information that you lack.";
            systemMessage += "\nIf relevant, you can use the original question in the message.";
            systemMessage += "\nNever guess. Don't reply that you don't know. Ask only about relevant information.";
            systemMessage += "\nIf you ask for more information, always set 'answerKnown' to false.";
            systemMessage += "\nIf you don't, set it to true";
        }
        if (concise) systemMessage += "\n\nAnswer concisely in as few words as possible.";

        log.log("Get answer:", systemMessage);

        const zodFormat =
            notAvailable === "ask"
                ? z.object({
                      answer: responseType.nullable(),
                      answerKnown: z.boolean(),
                      questionForInformation: z.string().nullable(),
                  })
                : z.object({
                      answer: responseType.nullable(),
                      answerKnown: z.boolean(),
                  });

        const answer = await this.client.beta.chat.completions.parse({
            model: defaultTextOptions.textModel,
            messages: [...history, { role: "system", content: systemMessage }], // we put the system message last
            response_format: zodResponseFormat(zodFormat, "answer"),
        });

        const { parsed, refusal } = answer.choices.first.message;

        if (refusal !== null || parsed === null) return { response: undefined, answerKnown: false };

        log.log(parsed);

        if (notAvailable === "ask" && !parsed.answerKnown)
            return {
                question: (parsed as unknown as { questionForInformation: string }).questionForInformation,
                answerKnown: false,
            };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
            response: parsed.answer as z.infer<T>,
            answerKnown: parsed.answerKnown,
        };
    }

    async getActionArgs<T extends IAction>(action: T, history: ChatHistory): Promise<z.infer<T["args"]> | undefined> {
        let question = `Given user's message, fill in arguments values for the following action:\n\nAction Intent: ${action.intent}`;
        if (action.additionalInstructions)
            question += `\nAdditional instructions:\n${action.additionalInstructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

        const result = await this.getAnswer({
            question,
            history,
            prefixQuestion: false,
            responseType: action.args,
        });

        log.info("Selected action args:", result);

        // The empty object with no fields is a valid response
        const isEmptyObject = Object.keys(result.response ?? {}).isEmpty;
        if (isEmptyObject) return {} as z.infer<T["args"]>;

        if (!result.answerKnown) {
            return undefined;
        }
        return result.response;
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

    private buildMessages(prompt: string, systemMessage?: string, history: ChatHistory = []) {
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
