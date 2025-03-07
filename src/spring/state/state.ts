import { History } from "./history";

export class State {
    readonly history = new History();

    // todo: memories...

    readonly systemMessage = `You are a helpful assistant replying in short concise messages.`;

    /* General functions */

    async load() {
        await this.history.load();
    }

    async reset() {
        await this.history.update([]);
    }
}
