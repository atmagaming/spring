import { nonNull, notImplemented } from "@elumixor/frontils";
import { formatDate } from "utils";
import { Apis } from "./apis";
import { authorize } from "./authorize";
import { agreementsFolderId, peopleRange, peopleSheetId, peopleSheetName, templatesRange } from "./config";
import { Doc } from "./doc";
import type { Agreement, IPersonData, IPersonTableData } from "./types";
import { getDocsUrl, getFileId } from "./utils";

export class ContractsManager {
    private apis!: Apis;
    private templates!: Map<Agreement, string>;
    people!: Map<string, IPersonTableData & { index: number }>;
    private initialized = false;

    async init() {
        if (!this.initialized) {
            const auth = await authorize({
                scope: ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"],
                tokenPath: "secret/google-token.json",
                credentialsPath: "secret/google-oauth-credentials.json",
            });

            this.apis = new Apis(auth);
        }
        this.initialized = true;

        {
            const response = await this.apis.sheets.spreadsheets.values.get({
                spreadsheetId: peopleSheetId,
                range: templatesRange,
            });
            const values = (response.data.values ?? []) as [Agreement, string, string][];
            const selected = values.map(([name, , link]) => [name, nonNull(getFileId(link))] as const);
            this.templates = new Map(selected);
        }

        {
            const response = await this.apis.sheets.spreadsheets.values.get({
                spreadsheetId: peopleSheetId,
                range: peopleRange,
            });
            const values = (response.data.values ?? []) as [string, string, string, string][];
            const selected = values.map(
                ([name, email, NDAUrl, WHAUrl], index) =>
                    [
                        name,
                        {
                            name,
                            email,
                            NDAUrl,
                            WHAUrl,
                            index,
                        } satisfies IPersonTableData & { index: number },
                    ] as const,
            );
            this.people = new Map(selected);
        }
    }

    getTemplateId(name: Agreement) {
        return this.templates.get(name);
    }

    getPerson(name: string) {
        return this.people.get(name);
    }

    getPersonFuzzy(_name: string) {
        notImplemented();
    }

    async addPerson(data: IPersonTableData) {
        // Throw if person already exists
        if (this.people.has(data.name)) throw new Error(`Person with the name ${data.name} already exists`);

        await this.apis.sheets.spreadsheets.values.append({
            spreadsheetId: peopleSheetId,
            range: peopleRange,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: [Object.values(data)],
            },
        });

        this.people.set(data.name, { ...data, index: this.people.size });
    }

    async updatePerson(
        data: {
            [k in keyof IPersonTableData]?: IPersonTableData[k] | null;
        } & { name: string },
    ) {
        const person = this.people.get(data.name);
        if (!person) throw new Error(`Person with the name ${data.name} does not exist`);

        const { index, ...rest } = person;
        const merged = { ...rest, ...data };

        await this.apis.sheets.spreadsheets.values.update({
            spreadsheetId: peopleSheetId,
            range: `${peopleSheetName}!A${index + 2}:D${index + 2}`,
            valueInputOption: "RAW",
            requestBody: {
                values: [[merged.name, merged.email, merged.NDAUrl ?? "", merged.WHAUrl ?? ""]],
            },
        });
    }

    async removePerson(name: string) {
        const person = this.people.get(name);
        if (!person) throw new Error(`Person with the name ${name} does not exist`);

        this.people.delete(name);

        const index = person.index;

        const sheets = await this.apis.sheets.spreadsheets.get({ spreadsheetId: peopleSheetId });
        const sheet = nonNull(sheets.data.sheets?.find((s) => s.properties?.title === peopleSheetName));

        // Remove them from the table
        await this.apis.sheets.spreadsheets.batchUpdate({
            spreadsheetId: peopleSheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: nonNull(sheet.properties?.sheetId),
                                dimension: "ROWS",
                                startIndex: index + 1,
                                endIndex: index + 2,
                            },
                        },
                    },
                ],
            },
        });

        // Remove their folder on the drive
        const folderId = await this.getPersonFolderId(name);
        await this.apis.drive.files.delete({ fileId: folderId });

        // Update indices
        for (const person of this.people.values()) if (person.index > index) person.index--;
    }

    async fromTemplate(personName: string, templateName: Agreement) {
        // Get person's folder
        const personFolderId = await this.getPersonFolder(personName);

        const templateId = this.getTemplateId(templateName);

        // Make a copy of the template
        const response = await this.apis.drive.files.copy({
            fileId: templateId,
            requestBody: {
                name: `${templateName} - ${Date.now()}`,
                mimeType: "application/vnd.google-apps.document",
                parents: [personFolderId],
            },
            fields: "id",
        });

        return new Doc(nonNull(response.data.id), this.apis);
    }

    async getPdf(fileId: string) {
        const [newId, converted] = await this.convertToGoogleDocs(fileId);

        const response = await this.apis.drive.files.export(
            { fileId: newId, mimeType: "application/pdf" },
            { responseType: "stream" },
        );

        const chunks = [];
        for await (const chunk of response.data) chunks.push(chunk);

        const buffer = Buffer.concat(chunks);

        if (converted) await this.apis.drive.files.delete({ fileId: newId });

        return buffer;
    }

    async createAgreement(person: IPersonData, type: Agreement) {
        let doc;

        // Add person if they don't exist
        if (!this.people.has(person.name)) {
            log.info(`Adding new person ${person.name} to the table`);
            await this.addPerson({ name: person.name, email: person.email });
            log.info(`Creating new ${type} for ${person.name}`);
            doc = await this.fromTemplate(person.name, type);
        } else {
            // Person exists and maybe has an agreement
            const personTableData = nonNull(this.people.get(person.name));
            const contractUrl = personTableData[`${type}Url` as const];

            // Check if already exists
            if (contractUrl) {
                // Remove it and create a new one
                log.info(`Removing existing ${type} for ${person.name}`);
                await this.apis.drive.files.delete({ fileId: getFileId(contractUrl) });
            }

            // Otherwise, create from template
            log.info(`Creating new ${type} for ${person.name}`);
            doc = await this.fromTemplate(person.name, type);
        }

        // Update fields with person data
        log.info("Updating fields with person data");
        await doc.setName(`${type} - ${person.name}`);
        doc.replace("[ROLE]", person.role);
        doc.replace("[IDENTIFICATION]", person.identification);
        doc.replace("[NAME]", person.name);
        doc.replace("[EMAIL]", person.email);
        doc.replace("[PASSPORT]", person.passport);
        doc.replace("[ISSUE_DATE]", person.issueDate);
        doc.replace("[AUTHORITY]", person.authority);

        // For date, use the current day
        doc.replace("[DATE]", formatDate(new Date()));
        await doc.save();

        // Update person table
        log.info("Updating person table");
        await this.updatePerson({
            name: person.name,
            email: person.email,
            [`${type}Url` as const]: getDocsUrl(doc.id),
        });

        return doc.id;
    }
    private async getPersonFolderId(name: string) {
        // Check if a folder with the person's name already exists
        const folderListResponse = await this.apis.drive.files.list({
            q: `'${agreementsFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}'`,
            fields: "files(id, name)",
        });

        // Folder already exists, use the existing folder ID
        if (folderListResponse.data.files?.nonEmpty) return folderListResponse.data.files.first.id ?? undefined;
    }

    private async getPersonFolder(name: string) {
        // Check if a folder with the person's name already exists
        const existingId = await this.getPersonFolderId(name);
        if (existingId) return existingId;

        // No folder exists, create a new one
        log.info(`Creating new folder for ${name}`);
        const folderResponse = await this.apis.drive.files.create({
            requestBody: {
                name,
                mimeType: "application/vnd.google-apps.folder",
                parents: [agreementsFolderId],
            },
            fields: "id",
        });

        return nonNull(folderResponse.data.id);
    }

    private async convertToGoogleDocs(fileId: string) {
        const fileMetadata = await this.apis.drive.files.get({
            fileId,
            fields: "id, name, mimeType",
        });

        // If the file is not already a Google Docs file, convert it
        if (fileMetadata.data.mimeType === "application/vnd.google-apps.document") return [fileId, false] as const;

        const response = await this.apis.drive.files.copy({
            fileId,
            requestBody: {
                name: "Converted Document",
                mimeType: "application/vnd.google-apps.document",
            },
            fields: "id",
        });

        return [nonNull(response.data.id), true] as const;
    }
}
