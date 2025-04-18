import { di } from "@elumixor/di";
import { nonNull } from "@elumixor/frontils";
import { formatDate, log } from "utils";
import { Apis } from "./apis";
import { agreementsFolderId } from "./config";
import type { UpdateParams } from "./databases";
import { Databases } from "./databases";
import { Doc } from "./doc";
import type { Agreement, IPersonData } from "./types";
import { getDocsUrl, getFileId } from "./utils";

export class ContractsManager {
    private readonly databases = di.inject(Databases);
    private readonly apis = di.inject(Apis);

    private get people() {
        return this.databases.people;
    }

    private get templates() {
        return this.databases.templates;
    }

    async init() {
        await this.databases.init();
    }

    getPerson(name: string) {
        return this.people.get(name);
    }

    getPersonFuzzy(name: string) {
        return this.people.getFuzzy(name);
    }

    addPerson(name: string, data: Partial<IPersonData>) {
        return this.people.add(name, data);
    }

    async updatePerson(name: string, data: UpdateParams<IPersonData>) {
        return this.people.update(name, data);
    }

    async removePerson(name: string) {
        await this.people.delete(name);

        // Remove their folder on the drive
        const folderId = await this.personFolderId(name);
        await this.apis.drive.files.delete({ fileId: folderId });
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

    async createAgreement(name: string, data: Partial<IPersonData>, identification: string, agreement: Agreement) {
        let doc;

        const agreementProperty = agreement === "NDA" ? "NDA" : "Contract";

        // Add person if they don't exist
        if (!this.people.has(name)) {
            log.info(`Adding new person ${name} to the table`);
            await this.addPerson(name, data);
            log.info(`Creating new ${agreement} for ${name}`);
            doc = await this.fromTemplate(name, agreement);
        } else {
            // Person exists and maybe has an agreement
            const personTableData = await this.people.get(name);
            const url = personTableData[agreementProperty];

            // Check if already exists
            if (url) {
                // Remove it and create a new one
                log.info(`Removing existing ${agreement} for ${name}`);
                await this.apis.drive.files.delete({ fileId: getFileId(url) });
            }

            // Otherwise, create from template
            log.info(`Creating new ${agreement} for ${name}`);
            doc = await this.fromTemplate(name, agreement);
        }

        // Update fields with person data
        log.info("Updating document fields with person data");
        await doc.setName(`${agreement} - ${name}`);

        doc.replace("[IDENTIFICATION]", identification);
        doc.replace("[NAME]", name);

        if (data.Position) doc.replace("[ROLE]", data.Position);
        if (data.Email) doc.replace("[EMAIL]", data.Email);
        if (data["Id Type"]) doc.replace("[ID_TYPE]", data["Id Type"]);
        if (data["Id Number"]) doc.replace("[ID_NUMBER]", data["Id Number"]);
        if (data["Issue Authority"]) doc.replace("[AUTHORITY]", data["Issue Authority"]);

        // For date, use the current day
        doc.replace("[DATE]", formatDate(new Date()));
        await doc.save();

        log.inspect(data);

        // Update person table
        log.info("Updating person table");
        await this.updatePerson(name, { ...data, [agreementProperty]: getDocsUrl(doc.id) });

        return doc.id;
    }

    async fromTemplate(personName: string, templateName: Agreement) {
        // Get person's folder
        const personFolderId = await this.personFolder(personName);
        const templateId = await this.getTemplateId(templateName);

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

    private async getTemplateId(name: Agreement) {
        const template = await this.templates.get(name);
        return getFileId(template.Url);
    }

    private async personFolderId(name: string) {
        // Check if a folder with the person's name already exists
        const folderListResponse = await this.apis.drive.files.list({
            q: `'${agreementsFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}'`,
            fields: "files(id, name)",
        });

        // Folder already exists, use the existing folder ID
        if (folderListResponse.data.files?.nonEmpty) return folderListResponse.data.files.first.id ?? undefined;
    }

    private async personFolder(name: string) {
        // Check if a folder with the person's name already exists
        const existingId = await this.personFolderId(name);
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
