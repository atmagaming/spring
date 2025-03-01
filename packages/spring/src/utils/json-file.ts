export async function readJSON<T>(filePath: string) {
    return JSON.parse(await Bun.file(filePath).text()) as T;
}
export async function writeJSON(filePath: string, value: unknown) {
    await Bun.write(filePath, JSON.stringify(value));
}
