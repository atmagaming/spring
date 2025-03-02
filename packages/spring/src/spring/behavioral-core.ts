import { di } from "@elumixor/di";
import { all } from "@elumixor/frontils";
import { AI } from "ai";
import { ChatBot, type ISendFileData, type TextBotMessage, type TextResponse } from "chat-bot";
import { DropboxSign } from "integrations/dropbox-sign";
import { ContractsManager } from "integrations/google-docs";
import { fullMessage } from "utils";
import {
    agreementAction,
    listPeopleAction,
    parsePassportAction,
    removePersonAction,
    respondAction,
    signAction,
    type IAction,
} from "./actions";
import { ModelParameters } from "./parameters";
import { State } from "./state";
import type { ParseMode } from "grammy/types";

export class BehavioralCore {
    selfName = "Spring";
    userName = "User";

    private readonly ai = di.inject(AI);
    private readonly chat = di.inject(ChatBot);

    private readonly state = new State();
    private readonly parameters = new ModelParameters();
    readonly actions = {
        respondAction,
        agreementAction,
        signAction,
        removePersonAction,
        listPeopleAction,
        parsePassportAction,
    };

    readonly integrations = {
        contractsManager: new ContractsManager(),
        dropboxSign: new DropboxSign(),
    };

    get voicePreferred() {
        return this.parameters.getBool("voicePreferred");
    }

    get historyString() {
        return this.state.history.asString(this.selfName, this.userName);
    }

    get systemMessage() {
        return this.state.systemMessage;
    }

    async load() {
        await all(this.state.load(), this.parameters.load());
    }

    async reset() {
        await all(this.state.reset(), this.parameters.reset());
    }

    async handleUserMessage(message: TextBotMessage) {
        await this.state.history.addMessage("user", message.text);

        // We do it in two steps: 1. select action, 2. select arguments
        // The reason is that it's impossible for us to ensure type safety/correct structure
        // if we try to do both at 1 step, as different actions have different arguments
        const action = await this.ai.selectAction(this.actions, this.state.history.value);
        const args = await this.ai.getActionArgs(action, this.state.history.value);

        log.log(`Taking action: ${action.intent} with args: ${JSON.stringify(args)}`);

        await action.run({ message, args, behavior: this });
    }

    async selectAction() {
        return this.ai.selectAction(this.actions, this.state.history.value);
    }

    async getActionArgs(action: IAction) {
        return this.ai.getActionArgs(action, this.state.history.value);
    }

    async respond({ file, text, parse_mode, ignoreHistory = false }: ResponseData) {
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
        if (!ignoreHistory && text) await this.state.history.addMessage("self", text);
    }
}

interface ResponseData {
    file?: ISendFileData;
    text?: TextResponse;
    ignoreHistory?: boolean;
    parse_mode?: ParseMode;
}
