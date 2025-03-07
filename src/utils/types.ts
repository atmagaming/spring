import type { ChunkedMessage } from "./iterable-emitter";

export type BotResponse = string | PromiseLike<string> | ChunkedMessage;

export type ToType<T> = { [key in keyof T]: T[key] };
