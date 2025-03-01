import { nonNull, notImplemented } from "@elumixor/frontils";
import { formatDate } from "utils";
import { Apis } from "./apis";
import { authorize } from "./authorize";
import { agreementsFolderId, peopleRange, peopleSheetId, peopleSheetName, templatesRange } from "./config";
import { Doc } from "./doc";
import type { ContractType, IPersonData, IPersonTableData } from "./person-data";
import { getDocsUrl, getFileId } from "./utils";

export class ContractsManager {
    private apis!: Apis;
    private templates!: Map<ContractType, string>;
    private people!: Map<string, IPersonTableData & { index: number }>;
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
            const values = (response.data.values ?? []) as [ContractType, string, string][];
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

    getTemplateId(name: ContractType) {
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
                values: [Object.values(merged).map((v) => (v === null ? "" : (v as unknown)))],
            },
        });
    }

    async removePerson(name: string) {
        const person = this.people.get(name);
        if (!person) throw new Error(`Person with the name ${name} does not exist`);

        this.people.delete(name);
        await this.apis.sheets.spreadsheets.values.clear({
            spreadsheetId: peopleSheetId,
            range: `${peopleSheetName}!A${person.index + 2}:D${person.index + 2}`,
        });
    }

    async fromTemplate(personName: string, templateName: ContractType) {
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

    async createAgreement(person: IPersonData, type: ContractType) {
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
            if (contractUrl) doc = new Doc(nonNull(getFileId(contractUrl)), this.apis);
            // Otherwise, create from template
            else {
                log.info(`Creating new ${type} for ${person.name}`);
                doc = await this.fromTemplate(person.name, type);
            }
        }

        // Update fields with person data
        log.info("Updating fields with person data");
        await doc.setName(`${type} - ${person.name}`);
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

    private async getPersonFolder(name: string) {
        // Check if a folder with the person's name already exists
        const folderListResponse = await this.apis.drive.files.list({
            q: `'${agreementsFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}'`,
            fields: "files(id, name)",
        });

        // Folder already exists, use the existing folder ID
        if (folderListResponse.data.files?.nonEmpty) return nonNull(folderListResponse.data.files.first.id);

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
