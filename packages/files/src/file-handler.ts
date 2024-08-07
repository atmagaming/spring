import { promises as fs } from "fs";
import path from "path";

export class FileHandler {
    readonly root;

    constructor(root: string) {
        this.root = path.resolve(root);
    }

    async getTree() {
        // Read files recursively from the root directory
        const files = await fs.readdir(this.root, { withFileTypes: true, recursive: true });
        const strings = files.map((file) => {
            const fullPath = path.resolve(file.parentPath, file.name);
            // Make it relative to the root
            const relative = path.relative(this.root, fullPath);
            return relative;
        });
        return strings;
    }

    async exists(id: string) {
        return fs.exists(this.p(id));
    }

    async readFile(id: string) {
        return fs.readFile(this.p(id));
    }

    async writeFile(id: string, content: Uint8Array) {
        return fs.writeFile(this.p(id), content);
    }

    async mkdir(id: string) {
        return fs.mkdir(this.p(id), { recursive: true });
    }

    async delete(id: string) {
        return fs.rm(this.p(id), { recursive: true });
    }

    init() {
        return this.mkdir(this.root);
    }

    private p(id: string) {
        return path.resolve(this.root, id);
    }
}
