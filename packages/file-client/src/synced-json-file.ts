import type { FileClient } from "./client";
import { SyncedFile, type SerializeOptions } from "./synced-file";

export class SyncedJsonFile<T> extends SyncedFile<"text", SerializeOptions<"text", T>, T> {
    constructor(
        client: FileClient,
        path: string,
        defaultValue: T,
        { deserialize = (v: string) => JSON.parse(v) as T, serialize = (v: T) => JSON.stringify(v) } = {},
    ) {
        super(client, path, "text", {
            defaultValue,
            deserialize,
            serialize,
        });
    }
}
