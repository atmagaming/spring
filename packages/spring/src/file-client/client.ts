export class FileClient {
    constructor(public url: string) {}

    async readRoot() {
        const response = await fetch(`${this.url}/tree`);
        const result = await response.json();
        return result;
    }

    async writeFile(id: string, content: Uint8Array, { append = false, replace = true } = {}) {
        const formData = new FormData();
        formData.append("id", id);
        formData.append("replace", replace.toString());
        formData.append("append", append.toString());
        formData.append("content", new Blob([content]));
        const response = await fetch(`${this.url}/write`, {
            method: "POST",
            body: formData,
        });
        if (response.ok) return;

        const text = await response.text();
        throw new Error(text);
    }

    async initFile(id: string, defaultContent: Uint8Array) {
        const formData = new FormData();
        formData.append("id", id);
        formData.append("defaultContent", new Blob([defaultContent]));
        const response = await fetch(`${this.url}/initFile`, {
            method: "POST",
            body: formData,
        });
        if (response.ok) return new Uint8Array(await response.arrayBuffer());

        const text = await response.text();
        throw new Error(text);
    }

    async mkdir(id: string) {
        const response = await fetch(`${this.url}/mkdir`, {
            method: "POST",
            body: JSON.stringify({ id }),
        });
        if (response.ok) return response.text();

        const text = await response.text();
        throw new Error(text);
    }

    async readFile(id: string): Promise<Uint8Array>;
    async readFile(id: string, encoding: "utf-8"): Promise<string>;
    async readFile(id: string, encoding?: "utf-8") {
        const response = await fetch(`${this.url}/read`, {
            method: "POST",
            body: JSON.stringify({ id }),
        });
        if (response.ok) {
            if (encoding) return response.text();
            return new Uint8Array(await response.arrayBuffer());
        }

        const text = await response.text();
        throw new Error(text);
    }
}
