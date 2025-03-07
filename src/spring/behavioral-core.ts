import { di } from "@elumixor/di";
import { EventEmitter } from "@elumixor/frontils";
import { AI } from "ai";
import { ChatBot, type ISendFileData, type TextBotMessage, type TextResponse } from "chat-bot";
import type { ParseMode } from "grammy/types";
import { DropboxSign } from "integrations/dropbox-sign";
import { ContractsManager } from "integrations/google";
import { fullMessage, log } from "utils";
import { z } from "zod";
import type { IAction } from "./actions";
import { agreementAction } from "./actions/actions/agreement";
import { databasesActions } from "./actions/actions/databases/main";
import { listActions } from "./actions/actions/list-actions";
import { parsePassportAction } from "./actions/actions/parse-passport";
import { removePersonAction } from "./actions/actions/remove-people";
import { respondAction } from "./actions/actions/respond";
import { signAction } from "./actions/actions/sign";
import { State } from "./state";

export class BehavioralCore {
    private readonly ai = di.inject(AI);
    private readonly chat = di.inject(ChatBot);

    private readonly state = new State();

    readonly actions = {
        respondAction,
        agreementAction,
        signAction,
        removePersonAction,
        // listPeopleAction,
        parsePassportAction,
        listActions,
        databasesActions,
    };

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

    async handleUserMessage(message: TextBotMessage) {
        await this.state.history.addMessage("user", message.text);
        if (this.awaitingMessage) {
            this.awaitingMessage = false;
            this.messageReceived.emit(message.text);
            return;
        }

        // We do it in two steps: 1. select action, 2. select arguments
        // The reason is that it's impossible for us to ensure type safety/correct structure
        // if we try to do both at 1 step, as different actions have different arguments
        const action = await this.ai.selectAction(this.actions, this.state.history.value);
        if (!action) return this.respond("I could not select the relevant action.");

        const args = await this.ai.getActionArgs(action, this.state.history.value);
        if (!args) return this.respond(`I could not select the relevant arguments for for action '${action.intent}'.`);

        // Run the action
        await (action as IAction).run({ message, args, behavior: this, ai: this.ai });
    }

    async selectAction() {
        return this.ai.selectAction(this.actions, this.history);
    }

    async getActionArgs(action: IAction) {
        return this.ai.getActionArgs(action, this.history);
    }

    async getAnswer(question: string): Promise<string>;
    async getAnswer<T extends z.ZodType>(question: string, responseType: T): Promise<z.infer<T>>;
    async getAnswer<T extends z.ZodType>(
        question: string,
        responseType = z.string() as unknown as T,
    ): Promise<z.infer<T>> {
        log.log("Trying to get an answer for", question);
        const result = await this.ai.getAnswer({
            question,
            history: this.history,
            responseType,
            notAvailable: "ask",
        });

        log.log("Got answer:", result);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        if (result.answerKnown) return result.response;
        if (result.question) await this.respond(result.question);
        await this.getUserMessage();
        return this.getAnswer(question, responseType);
    }

    respond(options: ResponseData): PromiseLike<void>;
    respond(text: TextResponse): PromiseLike<void>;
    async respond(response: ResponseData | TextResponse) {
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
}

interface ResponseData {
    file?: ISendFileData;
    text?: TextResponse;
    ignoreHistory?: boolean;
    parse_mode?: ParseMode;
}
