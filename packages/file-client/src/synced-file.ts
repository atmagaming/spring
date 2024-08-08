import { assert } from "@elumixor/frontils";
import type { FileClient } from "./client";

export type FileType = "text" | "binary";
export type FileContent<T extends FileType> = T extends "text" ? string : Uint8Array;
export type Deserialize<T extends FileType, V> = (a: FileContent<T>) => V;
export type Serialize<T extends FileType, V> = (a: V) => FileContent<T>;

export interface SerializeOptions<T extends FileType, V> {
    defaultValue?: V;
    deserialize?: Deserialize<T, V>;
    serialize?: Serialize<T, V>;
}

export class SyncedFile<T extends FileType, U extends SerializeOptions<T, V>, V = FileContent<T>> {
    /** This is used to chain promises together to disallow race conditions */
    private lastPromise = Promise.resolve();

    private _value?: V;
    private initializing = false;

    constructor(
        private readonly client: FileClient,
        private readonly path: string,
        private readonly type: T,
        private readonly options?: U,
    ) {}

    get value(): V {
        assert(this._value !== undefined, "File not initialized");
        return this._value;
    }
    set value(value) {
        this._value = value;
        void this.write(this.options?.serialize?.(value) ?? (value as FileContent<T>));
    }

    update(value: V) {
        this.value = value;
        return this.lastPromise;
    }

    /** Write the content to the file */
    private async write(content: T extends "text" ? string : Uint8Array, { append = false, replace = true } = {}) {
        const bytes = this.type === "text" ? Buffer.from(content as string) : (content as Uint8Array);
        return this.chain(() => this.client.writeFile(this.path, bytes, { append, replace }));
    }

    /** Returns file contents, or creates default with the specified value if the file did not exist yet */
    async initialize() {
        assert(!this._value, "File already initialized");
        assert(!this.initializing, "File is already initializing");
        this.initializing = true;

        const bytes =
            this.type === "text"
                ? Buffer.from(this.options?.defaultValue ? this.serialize(this.options.defaultValue) : "")
                : ((this.options?.defaultValue ?? new Uint8Array()) as Uint8Array);

        const resultPromise = this.client.initFile(this.path, bytes);
        this.lastPromise = resultPromise.then(() => undefined);
        const result = await resultPromise;
        const fileContent = (this.type === "text" ? new TextDecoder("utf-8").decode(result) : result) as FileContent<T>;
        const deserialized = this.deserialize(fileContent);
        this._value = deserialized;
        return deserialized;
    }

    private chain<T>(fn: () => Promise<T>) {
        const result = this.lastPromise.then(() => fn());
        this.lastPromise = result.then(() => undefined);
        return result;
    }

    private serialize(value: V) {
        return this.options?.serialize?.(value) ?? (value as FileContent<T>);
    }
    private deserialize(value: FileContent<T>) {
        return this.options?.deserialize?.(value) ?? (value as V);
    }
}
