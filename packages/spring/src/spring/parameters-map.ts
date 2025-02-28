import { FileClient, SyncedJsonFile } from "file-client";
import { paths } from "config";
import type { JSONPrimitive } from "types-json";

export class ParametersMap extends SyncedJsonFile<Map<string, JSONPrimitive>> {
    constructor(fileClient: FileClient) {
        super(fileClient, paths.parameters, new Map(), {
            serialize: (v) => JSON.stringify([...v.values()]),
            deserialize: (v) => new Map(JSON.parse(v) as [string, JSONPrimitive][]),
        });
    }

    set(key: string, value: JSONPrimitive) {
        this.value.set(key, value);
        return this.update(this.value);
    }

    get(key: string) {
        return this.value.get(key);
    }

    delete(key: string) {
        this.value.delete(key);
        return this.update(this.value);
    }

    clear() {
        this.value.clear();
        return this.update(this.value);
    }
}
