import { di } from "@elumixor/di";
import { EventEmitter, nonNull } from "@elumixor/frontils";
import { AI } from "ai";
import { ChatBot, type TextBotMessage, type TextResponse } from "chat-bot";
import { DropboxSign } from "integrations/dropbox-sign";
import { ContractsManager } from "integrations/google";
import type { ChatCompletionMessageToolCall } from "openai/resources/index.mjs";
import { fullMessage, log } from "utils";
import { z } from "zod";
import { Action } from "./action";
import { State } from "./state";
import type { ResponseData } from "./types";

@di.injectable
export class Core {
    private readonly ai = di.inject(AI);
    private readonly chat = di.inject(ChatBot);
    private readonly state = new State();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly actions = [] as Action<any>[];

    readonly integrations = {
        contractsManager: new ContractsManager(),
        dropboxSign: new DropboxSign(),
    };

    private awaitingMessage = false;
    private readonly messageReceived = new EventEmitter<string>();

    readonly voicePreferred: boolean = false;

    // get voicePreferred() {
    //     return this.parameters.getBool("voicePreferred");
    // }

    get historyString() {
        return this.state.history.toString();
    }

    get systemMessage() {
        return this.state.systemMessage;
    }

    get history() {
        return this.state.history.value;
    }

    async load() {
        await this.state.load();
    }

    async reset() {
        await this.state.reset();
    }

    async onUserMessage(message: TextBotMessage) {
        // If we're waiting for a message, redirect the handling
        if (this.awaitingMessage) {
            this.awaitingMessage = false;
            this.messageReceived.emit(message.text);
            return;
        }

        // Add message to history
        await this.state.history.addMessage("user", message.text);

        // Check tool calls
        const result = await this.ai.client.chat.completions.create({
            model: this.ai.textModel,
            messages: [{ role: "system", content: this.systemMessage }, ...this.history],
            tools: this.actions.map((action) => action.schema),
            tool_choice: "auto",
        });

        const toolCalls = result.choices[0].message.tool_calls;
        if (toolCalls?.nonEmpty) return this.handleToolCall(toolCalls.first, message);

        const textResponse = result.choices[0].message.content;
        if (textResponse) return this.sendMessage(textResponse);
    }

    sendMessage(options: ResponseData): PromiseLike<void>;
    sendMessage(text: TextResponse): PromiseLike<void>;
    async sendMessage(response: ResponseData | TextResponse) {
        if (typeof response === "string") response = { text: response };
        const { file, text, ignoreHistory, parse_mode } = response as ResponseData;
        if (file)
            // if some file data is provided - send file
            await this.chat.sendFile({ ...file, caption: text ? await fullMessage(text) : undefined, parse_mode });
        else if (text) {
            // Otherwise, send text, unless voice is preferred
            if (!this.voicePreferred) await this.chat.sendText(text, parse_mode);
            else {
                const voiceBuffer = await this.ai.textToVoice(await fullMessage(text));
                await this.chat.sendVoice(voiceBuffer);
            }
        }

        // Add to history
        if (!ignoreHistory && text) await this.state.history.addMessage("assistant", text);
    }

    async getUserMessage() {
        this.awaitingMessage = true;
        return this.messageReceived.nextEvent;
    }

    private async handleToolCall(
        { function: { name, arguments: args } }: ChatCompletionMessageToolCall,
        message: TextBotMessage,
    ) {
        const tool = nonNull(this.actions.find((action) => action.name === name));

        log.info(`Decided to call ${name} with args: ${args}`);
        await tool.run(JSON.parse(args) as Partial<z.infer<typeof tool.args>>, message);
    }
}
