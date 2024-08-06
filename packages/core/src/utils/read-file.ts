import fs from "fs/promises";
import type { JSONValue } from "types-json";

export async function readFile(path: string) {
    // Check if file exists
    if (await fs.exists(path)) return fs.readFile(path, "utf-8");

    // Attempt to get default content
    const hasExtension = path.includes(".");
    let defaultPath;
    if (!hasExtension) defaultPath = path + ".default";
    else {
        const parts = path.split(".");
        const extension = parts.pop();
        assert(extension !== undefined);
        defaultPath = parts.join(".") + ".default." + extension;
    }

    if (await fs.exists(defaultPath)) return fs.readFile(defaultPath, "utf-8");
    return undefined;
}

export async function writeFile(path: string, content: string | undefined) {
    if (content === undefined) return fs.unlink(path);
    return fs.writeFile(path, content, "utf-8");
}

export async function readJSON<T = JSONValue>(path: string) {
    const content = await readFile(path);
    if (content === undefined) return undefined;
    return JSON.parse(content) as T;
}

export async function writeJSON(path: string, data: JSONValue | undefined) {
    return writeFile(path, JSON.stringify(data));
}
