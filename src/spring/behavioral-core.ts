import { all, EventEmitter } from "@elumixor/frontils";
import type { AiModel } from "ai-model";
import { ModelParameters } from "./parameters";
import { State } from "./state";
import type { ChunkedMessage } from "utils";

export class BehavioralCore {
    readonly sendMessageRequested = new EventEmitter<ChunkedMessage | string>();

    private readonly state = new State();
    private readonly parameters = new ModelParameters();

    constructor(private readonly aiModel: AiModel) {}

    get voicePreferred() {
        return this.parameters.getBool("voicePreferred");
    }

    get historyString() {
        return this.state.historyString;
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

    acceptMessage(text: string) {
        this.state.addUserMessage(text);

        const response = this.aiModel.textCompletion(text, {
            chunk: "logical",
            systemMessage: this.systemMessage,
            history: this.state.history,
        });

        void response.fullMessage.then((message) => this.state.addSelfMessage(message));

        this.sendMessageRequested.emit(response);
    }
}
