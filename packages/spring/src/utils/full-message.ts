import { ChunkedMessage } from "./iterable-emitter";

export async function fullMessage(text: string | PromiseLike<string> | ChunkedMessage) {
    const isChunked = text instanceof ChunkedMessage;
    if (!isChunked) return text;
    else return text.fullMessage;
}
