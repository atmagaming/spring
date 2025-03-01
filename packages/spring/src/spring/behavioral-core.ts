import { all, AsyncEventEmitter, EventEmitter } from "@elumixor/frontils";
import type { AI } from "ai";
import type { ISendFileData, TextBotMessage } from "chat-bot";
import type { BotResponse } from "utils/types";
import { actions } from "./actions";
import { ModelParameters } from "./parameters";
import { State } from "./state";
import { fullMessage } from "utils";

export class BehavioralCore {
    selfName = "Spring";
    userName = "User";

    readonly sendMessageRequested = new EventEmitter<BotResponse>();
    readonly sendFileRequested = new AsyncEventEmitter<ISendFileData>();

    private readonly state = new State();
    private readonly parameters = new ModelParameters();
    private readonly actions = actions;

    constructor(private readonly aiModel: AI) {}

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

    async acceptMessage(message: TextBotMessage) {
        const { text, photo: media } = message;

        await this.state.history.addMessage("user", text);
        const { action, args } = await this.aiModel.selectAction(text, actions, this.state.history.value);

        log.log(`Taking action: ${action.intent} with args: ${JSON.stringify(args)}`);

        await action.run({
            media,
            text: message.text,
            args,
            complete: (text) =>
                this.aiModel.textCompletion(text, {
                    chunk: "logical",
                    systemMessage: this.state.systemMessage,
                    history: this.state.history.value,
                }),
            respond: (data) => {
                this.sendMessageRequested.emit(data);
                void fullMessage(data).then((msg) => this.state.history.addMessage("self", msg));
            },
            sendFile: (data) => this.sendFileRequested.emit(data),
            addToHistory: (role, message) => this.state.history.addMessage(role, message),
        });
    }
}
