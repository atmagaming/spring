import { all, EventEmitter } from "@elumixor/frontils";
import type { AiModel } from "ai-model";
import type { ChunkedMessage } from "utils";
import { ModelParameters } from "./parameters";
import { State } from "./state";

export class BehavioralCore {
    selfName = "Spring";
    userName = "User";

    readonly sendMessageRequested = new EventEmitter<ChunkedMessage | string>();

    private readonly state = new State();
    private readonly parameters = new ModelParameters();

    constructor(private readonly aiModel: AiModel) {}

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

    async acceptMessage(text: string) {
        this.state.history.addMessage("user", text);

        const response = this.aiModel.textCompletion(text, {
            chunk: "logical",
            systemMessage: this.state.systemMessage,
            history: this.state.history.value,
        });

        this.sendMessageRequested.emit(response);

        const message = await response.fullMessage;
        this.state.history.addMessage("self", message);
    }
}
