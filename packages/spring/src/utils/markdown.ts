import { parse } from "marked";

export async function isValidMarkdown(message: string) {
    try {
        await parse(message);
        return true;
    } catch (error) {
        return false;
    }
}
