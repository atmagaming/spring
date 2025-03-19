import { di } from "@elumixor/di";
import { nonNull, notImplemented, zip } from "@elumixor/frontils";
import { log } from "utils";
import { Apis } from "../apis";
import { getFileId } from "../utils";

export type UpdateParams<T extends Record<string, string>> = { [k in keyof T]?: T[k] | null };

export class Database<TProps extends Record<string, string> = Record<string, string>> {
    protected readonly apis = di.inject(Apis);
    protected refreshSeconds = 5; // duration assumed the database is not changed

    readonly id;
    readonly url;
    private _sheetName;
    readonly name;

    private _keys = [] as string[];
    private _properties = [] as (keyof TProps)[];
    private sheetId = 0;

    private lastRefresh = 0;

    constructor({ url, sheetName = "", name = "Unnamed DB" }: { url: string; sheetName?: string; name?: string }) {
        this.url = url;
        this.id = getFileId(url);
        this._sheetName = sheetName;
        this.name = name;
    }

    get keys() {
        return this._keys;
    }

    get properties() {
        return this._properties;
    }

    get sheetName() {
        return this._sheetName;
    }

    has(name: string) {
        return this.keys.includes(name);
    }

    async refreshMetadata() {
        // Check if refresh was not too long ago
        const now = Date.now();
        if (now - this.lastRefresh < this.refreshSeconds * 1000) return;
        this.lastRefresh = now;

        log.info("Refreshing metadata for DB", this.name);

        const response = await this.apis.sheets.spreadsheets.get({
            spreadsheetId: this.id,
            fields: "sheets.properties",
        });

        const sheets = response.data.sheets ?? [];
        if (this.sheetName === "") {
            const { title, sheetId } = sheets.first.properties ?? {};
            this._sheetName = nonNull(title);
            this.sheetId = nonNull(sheetId);
        } else {
            const sheet = nonNull(sheets.find((sheet) => sheet.properties?.title === this.sheetName));
            this.sheetId = nonNull(sheet.properties?.sheetId);
        }
        const [keysResponse, propertiesResponse] = await Promise.all([
            this.apis.sheets.spreadsheets.values.get({
                spreadsheetId: this.id,
                range: `${this.sheetName}!A2:A`,
            }),
            this.apis.sheets.spreadsheets.values.get({
                spreadsheetId: this.id,
                range: `${this.sheetName}!1:1`,
            }),
        ]);

        this._keys = (keysResponse.data.values ?? [])
            .flat()
            .filter((s) => String(s ?? "").trim() !== "")
            .unique() as string[];

        this._properties = (propertiesResponse.data.values?.first ?? [])
            .skip(1)
            .filter((s) => String(s ?? "").trim() !== "")
            .unique() as (keyof TProps)[];
    }

    async get(name: string) {
        const index = this.getIndex(name);

        const response = await this.apis.sheets.spreadsheets.values.get({
            spreadsheetId: this.id,
            range: `${this.sheetName}!B${index}:${this.columnLetter(this.properties.length + 1)}${index}`,
        });

        this.fixResponse(response);

        const values = (response.data.values?.flat() ?? []) as string[];
        return Object.fromEntries(zip(this.properties, values)) as TProps;
    }

    async getAll() {
        const response = await this.apis.sheets.spreadsheets.values.get({
            spreadsheetId: this.id,
            range: `${this.sheetName}!A2:${this.columnLetter(this.properties.length + 1)}${this.keys.length + 1}`,
        });

        this.fixResponse(response);

        return (
            response.data.values?.map(
                ([name, ...data]) =>
                    ({
                        name: name as string,
                        data: Object.fromEntries(
                            zip(
                                this.properties,
                                data.map((e) => (e ?? "") as unknown),
                            ),
                        ) as TProps,
                    }) as {
                        name: string;
                        data: TProps;
                    },
            ) ?? []
        );
    }

    getFuzzy(_name: string): Promise<never> {
        notImplemented();
    }

    async rename(name: string, newName: string) {
        const index = this.getIndex(name);

        await this.apis.sheets.spreadsheets.values.update({
            spreadsheetId: this.id,
            range: `${this.sheetName}!A${index}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[newName]],
            },
        });

        this._keys[index - 2] = newName;
    }

    async delete(name: string) {
        const index = this.getIndex(name);

        await this.apis.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.id,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: this.sheetId,
                                dimension: "ROWS",
                                startIndex: index - 1,
                                endIndex: index,
                            },
                        },
                    },
                ],
            },
        });

        this._keys.removeAt(index - 2);
    }

    async add(name: string, data?: Partial<TProps>) {
        const arr = Array.from({ length: this.properties.length }).map(() => "");

        for (const [key, value] of Object.entries(data ?? {})) {
            const index = this.properties.indexOf(key as keyof TProps);
            if (index >= 0) arr[index] = value as string;
        }

        const index = this.keys.length + 2;

        await this.apis.sheets.spreadsheets.values.append({
            spreadsheetId: this.id,
            range: `${this.sheetName}!A${index}:${this.columnLetter(this.properties.length + 1)}${index}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[name, ...arr]],
            },
        });

        this._keys.push(name);
    }

    async update(name: string, data: UpdateParams<TProps>) {
        const index = this.getIndex(name);

        const response = await this.apis.sheets.spreadsheets.values.get({
            spreadsheetId: this.id,
            range: `${this.sheetName}!B${index}:${this.columnLetter(this.properties.length + 1)}${index}`,
        });

        const arr = (response.data.values?.flat() ?? []) as string[];

        for (const [key, value] of Object.entries(data)) {
            const index = this.properties.indexOf(key as keyof TProps);
            if (index < 0) {
                log.warn(`Property ${key} does not exist in the database`);
                continue;
            }

            arr[index] = (value as string | null) ?? "";
        }

        await this.apis.sheets.spreadsheets.values.update({
            spreadsheetId: this.id,
            range: `${this.sheetName}!B${index}:${this.columnLetter(this.properties.length + 1)}${index}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [arr],
            },
        });
    }

    async addProperty(name: string) {
        this.properties.push(name as keyof TProps);

        await this.apis.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.id,
            requestBody: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: this.sheetId,
                                dimension: "COLUMNS",
                                startIndex: this.properties.length,
                                endIndex: this.properties.length + 1,
                            },
                            inheritFromBefore: true,
                        },
                    },
                ],
                includeSpreadsheetInResponse: false,
                responseRanges: [],
                responseIncludeGridData: false,
            },
        });

        await this.apis.sheets.spreadsheets.values.update({
            spreadsheetId: this.id,
            range: `${this.sheetName}!${this.columnLetter(this.properties.length)}1`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[name]],
            },
        });
    }

    async renameProperty(name: string, newName: string) {
        const index = this.properties.indexOf(name as keyof TProps);
        if (index < 0) throw new Error(`Property ${name} does not exist in the database`);
        this.properties[index] = newName as keyof TProps;

        await this.apis.sheets.spreadsheets.values.update({
            spreadsheetId: this.id,
            range: `${this.sheetName}!${this.columnLetter(index + 1)}1`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[newName]],
            },
        });
    }

    async removeProperty(name: string) {
        const index = this.properties.indexOf(name as keyof TProps);
        if (index < 0) throw new Error(`Property ${name} does not exist in the database`);
        this.properties.removeAt(index);

        await this.apis.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.id,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: this.sheetId,
                                dimension: "COLUMNS",
                                startIndex: index + 1,
                                endIndex: index + 2,
                            },
                        },
                    },
                ],
            },
        });
    }

    private fixResponse(response: { data: { values?: unknown[][] | null } }) {
        if (!response.data.values) return;
        for (const row of response.data.values) while (row.length < this.properties.length + 1) row.push("");
    }

    private getIndex(name: string) {
        const index = this.keys.indexOf(name) + 2;
        if (index < 2) throw new Error(`Key ${name} does not exist in the database`);
        return index;
    }

    private columnLetter(column: number): string {
        if (column < 0) throw new Error("Column cannot be negative");
        column++;
        let letter = "";
        while (column > 0) {
            const temp = (column - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            column = Math.floor((column - temp - 1) / 26);
        }

        return letter;
    }
}
