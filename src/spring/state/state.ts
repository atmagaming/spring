import { di } from "@elumixor/di";
import { History } from "./history";

@di.injectable
export class State {
    readonly history = new History();

    // todo: memories...

    readonly systemMessage = `
    You are a helpful assistant replying in short concise messages.
    If you call an action/tool and don't have all optional args, call the action without the optional args. Set them to null.
    Don't ask for args that are not explicitly required by actions.
    `;

    /* General functions */

    async load() {
        await this.history.load();
    }

    async reset() {
        await this.history.update([]);
    }
}
