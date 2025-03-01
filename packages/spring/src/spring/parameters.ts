import { di } from "@elumixor/di";
import { ParametersMap } from "./parameters-map";
import { FileClient } from "file-client";

export class ModelParameters {
    private readonly map = new ParametersMap(di.inject(FileClient));

    load() {
        return this.map.initialize();
    }

    getBool(key: string, defaultValue = false) {
        const value = this.map.get(key);
        if (value !== undefined || typeof value !== "boolean") return defaultValue;
        return value;
    }

    setBool(key: string, value: boolean) {
        void this.map.set(key, value);
    }

    reset() {
        return this.map.clear();
    }
}
