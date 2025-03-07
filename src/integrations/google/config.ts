import { nonNull } from "@elumixor/frontils";
import { getFileId } from "./utils";

export const agreementsFolderUrl = import.meta.env.AGREEMENTS_FOLDER;
export const agreementsFolderId = agreementsFolderUrl.split("/").last;
export const peopleSheetLink = import.meta.env.DB_PEOPLE;
export const peopleSheetId = nonNull(getFileId(peopleSheetLink));

export const peopleSheetName = "People";
export const templatesSheetName = "Templates";
export const templatesRange = `${templatesSheetName}!A2:C`;
export const peopleRange = `${peopleSheetName}!A2:D`;
