import { EventEmitter } from "@elumixor/frontils";

export class IterableEmitter<T> implements AsyncIterable<T> {
    readonly chunkReceived = new EventEmitter<T>();
    readonly completed = new EventEmitter<T[]>();

    private readonly chunks: T[] = [];
    constructor(private readonly iterable: AsyncIterable<T>) {}

    async *[Symbol.asyncIterator]() {
        for await (const chunk of this.iterable) {
            this.chunks.push(chunk);
            this.chunkReceived.emit(chunk);
            yield chunk;
        }

        this.completed.emit(this.chunks);
    }
}

export class ChunkedMessage extends IterableEmitter<string> {
    private fullMessageEmitter = new EventEmitter<string>();
    private _fullMessage: string | undefined;
    constructor(chunks: AsyncIterable<string>) {
        super(chunks);

        this.completed.subscribeOnce((chunks) => {
            this._fullMessage = chunks.join("");
            this.fullMessageEmitter.emit(this._fullMessage);
        });
    }
    get fullMessage() {
        if (this._fullMessage === undefined) return this.fullMessageEmitter.nextEvent;
        return Promise.resolve(this._fullMessage);
    }
}

export async function joinChunks(chunks: AsyncIterable<string>) {
    let result = "";
    for await (const chunk of chunks) result += chunk;
    return result;
}

export async function fullMessage(text: string | PromiseLike<string> | ChunkedMessage) {
    const isChunked = text instanceof ChunkedMessage;
    if (!isChunked) return text;
    else return text.fullMessage;
}
