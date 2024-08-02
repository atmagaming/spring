import type { JSONPrimitive } from "types-json";
import { readJSON, writeJSON } from "utils";
import { paths } from "config";

export type ParametersMap = Map<string, JSONPrimitive>;
export class ModelParameters {
    private readonly map = new Map<string, JSONPrimitive>();

    async load() {
        // Load the parameters from the file
        const data = await readJSON<ParametersMap>(paths.parameters);
        if (!data) return;

        for (const [key, value] of Object.entries(data)) this.map.set(key, value as JSONPrimitive);
    }

    getBool(key: string, defaultValue = false) {
        const value = this.map.get(key);
        if (value !== undefined || typeof value !== "boolean") return defaultValue;
        return value;
    }
    setBool(key: string, value: boolean) {
        this.map.set(key, value);
        void this.save();
    }

    async reset() {
        this.map.clear();
        await this.save();
    }

    private async save() {
        const data = {} as Record<string, JSONPrimitive>;
        for (const [key, value] of this.map) data[key] = value;
        await writeJSON(paths.parameters, data);
    }
}
