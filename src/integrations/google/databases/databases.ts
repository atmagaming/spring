import { di } from "@elumixor/di";
import { Database } from "./database";

@di.injectable
export class Databases extends Database<{ url: string; sheetName: string }> {
    constructor() {
        super(import.meta.env.DB_DATABASES);
    }

    async getDatabase<T extends Record<string, string>>(name: string) {
        await this.refreshMetadata();
        const { url, sheetName } = await this.get(name);
        const db = new Database<T>(url, sheetName);
        await db.refreshMetadata();
        return db;
    }
}
