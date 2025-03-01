import type { Apis } from "./apis";

export class Doc {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private requests = [] as any[];

    constructor(
        readonly id: string,
        private readonly apis: Apis,
    ) {}

    async setName(name: string) {
        await this.apis.drive.files.update({ fileId: this.id, requestBody: { name } });
    }

    replace(pattern: string, replacement: string) {
        this.requests.push({
            replaceAllText: {
                containsText: {
                    text: pattern,
                    matchCase: true,
                },
                replaceText: replacement,
            },
        });
    }

    async save() {
        await this.apis.docs.documents.batchUpdate({
            documentId: this.id,
            requestBody: { requests: this.requests },
        });
    }
}
