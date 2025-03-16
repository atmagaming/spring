import { di } from "@elumixor/di";
import type { IPersonData, ITemplateData } from "../types";
import { Database } from "./database";

@di.injectable
export class Databases extends Database<{ url: string; sheetName: string }> {
    private _people!: Database<IPersonData>;
    private _templates!: Database<ITemplateData>;

    constructor() {
        super({ url: import.meta.env.DB_DATABASES, name: "Databases" });
    }

    get people() {
        return this._people;
    }

    get templates() {
        return this._templates;
    }

    async init() {
        await this.refreshMetadata();
        [this._people, this._templates] = await Promise.all([
            this.getDatabase<IPersonData>("People"),
            this.getDatabase<ITemplateData>("Templates"),
        ]);
    }

    async getDatabase<T extends Record<string, string>>(name: string) {
        await this.refreshMetadata();
        const { url, sheetName } = await this.get(name);
        const db = new Database<T>({ url, sheetName, name });
        await db.refreshMetadata();
        return db;
    }
}
