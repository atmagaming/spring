import type { ChunkedMessage } from "./iterable-emitter";

export type BotResponse = string | PromiseLike<string> | ChunkedMessage;
