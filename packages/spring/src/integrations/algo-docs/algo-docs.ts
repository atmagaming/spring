/* eslint-disable no-console */
import chalk from "chalk";
import { readFile } from "fs/promises";
import { basename } from "path";
import type { ExtractedData, Extractor, Folder, UploadDocumentResponse } from "./types";

export class AlgoDocs {
    private readonly apiKey;
    private readonly email;
    private readonly extractorId;
    private readonly folderId;
    private readonly authHeaders;

    constructor({
        apiKey = import.meta.env.ALGODOCS_API_KEY,
        email = import.meta.env.ALGODOCS_EMAIL,
        extractorId = import.meta.env.ALGODOCS_EXTRACTOR_ID,
        folderId = import.meta.env.ALGODOCS_FOLDER_ID,
    } = {}) {
        this.apiKey = apiKey;
        this.email = email;
        this.extractorId = extractorId;
        this.folderId = folderId;
        this.authHeaders = { Authorization: `Basic ${btoa(`${this.email}:${this.apiKey}`)}` };
    }

    async process(filePath: string) {
        const { id } = await this.uploadDocument(filePath);
        return this.getExtractedData(id);
    }

    async uploadDocument(filePath: string) {
        const fileName = basename(filePath);
        const url = `https://api.algodocs.com/v1/document/upload_base64/${this.extractorId}/${this.folderId}`;

        const fileBuffer = await readFile(filePath);
        const fileBase64 = fileBuffer.toString("base64");

        const formData = new FormData();
        formData.append("file_base64", fileBase64);
        formData.append("filename", fileName);

        const result = await this.fetch<UploadDocumentResponse>(url, { method: "POST", body: formData });

        // eslint-disable-next-line no-console
        console.log(`Uploaded document: ${chalk.yellow(filePath)}. Assigned id: ${chalk.green(result.id)}`);

        return result;
    }

    async getExtractors() {
        return this.fetch<Extractor[]>("https://api.algodocs.com/v1/extractors");
    }

    async getFolders() {
        return this.fetch<Folder[]>("https://api.algodocs.com/v1/folders");
    }

    async getExtractedData(documentId: string | number) {
        return this.fetch<ExtractedData[]>(`https://api.algodocs.com/v1/extracted_data/${documentId}`);
    }

    private async fetch<T>(url: string, options: RequestInit = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.authHeaders,
                ...(options.headers ?? {}),
            },
        });

        return response.json() as Promise<T>;
    }
}

// Command-line execution logic
if (require.main === module) {
    const mode = process.argv[2];
    if (mode === "--upload" || mode === "-u") {
        // This block runs if the file is executed directly
        const filePath = process.argv[3]; // Get the file path from the command line
        if (!filePath) {
            console.error(chalk.red("Please provide a file path."));
            process.exit(1);
        }

        const algoDocs = new AlgoDocs();
        const result = await algoDocs.uploadDocument(filePath);
        console.log(result.id);
    } else if (mode === "--extract" || mode === "-e") {
        const documentId = process.argv[3];
        if (!documentId) {
            console.error(chalk.red("Please provide a document ID."));
            process.exit(1);
        }

        const algoDocs = new AlgoDocs();
        const result = await algoDocs.getExtractedData(documentId);
        console.log(result);
    }
}
