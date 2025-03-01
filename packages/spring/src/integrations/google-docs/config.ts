import { nonNull } from "@elumixor/frontils";
import { getFileId } from "./utils";

export const agreementsFolderUrl = "https://drive.google.com/drive/u/3/folders/1QRd5kH0hL_d_2KAvFcIZfYB046_1efW9";
export const agreementsFolderId = agreementsFolderUrl.split("/").last;
export const peopleSheetLink = "https://docs.google.com/spreadsheets/d/1a0qec4MxEz8mpYXvbdcLiBMKyhxpAwIdMpJva74pk-U";
export const peopleSheetId = nonNull(getFileId(peopleSheetLink));

export const peopleSheetName = "People";
export const templatesSheetName = "Templates";
export const templatesRange = `${templatesSheetName}!A2:C`;
export const peopleRange = `${peopleSheetName}!A2:D`;
