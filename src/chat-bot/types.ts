import type { Awaitable } from "@elumixor/frontils";
import type { ChunkedMessage } from "utils";

export interface IFileData {
    id: string;
    buffer: Buffer;
    name: string;
}

export interface ISendFileData {
    buffer: Buffer;
    fileName: string;
}

export type TextResponse = Awaitable<string> | ChunkedMessage;
