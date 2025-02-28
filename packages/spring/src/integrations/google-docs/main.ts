import { nonNull } from "@elumixor/frontils";
import { ContractsManager } from "./contracts-manager";

// Add new person to the people sheet
const manager = new ContractsManager();
await manager.init();

// await manager.addPerson({
//     name: "John Doe",
//     email: "l8b3H@example.com",
// });

// await manager.update({
//     name: "John Doe",
//     email: null,
// });

// await manager.remove("John Doe");

// const personNDA = await manager.fromTemplate("NDA");
// await personNDA.setName("NDA - John Doe");
// personNDA.replace("[NAME]", "John Doe");
// personNDA.replace("[EMAIL]", "l8b3H@example.com");
// await personNDA.save();

// const bufferPersonNDA = await manager.getPdf(personNDA.id);
// await Bun.write("nda-person.pdf", bufferPersonNDA);
// console.log("NDA done");

const id = await manager.createAgreement(
    {
        name: "John Doe",
        email: "l8b3H@example.com",
        passport: "12345678",
        authority: "USA",
        issueDate: "12 July 1998",
    },
    "NDA",
);

const bufferNDA = await manager.getPdf(nonNull(id));
await Bun.write("nda.pdf", bufferNDA);
log.info("NDA done");

// const bufferNDA = await manager.getPdf(nonNull(ndaTemplateId));
// await Bun.write("nda.pdf", bufferNDA);
// console.log("NDA done");

// const whaTemplateId = manager.getTemplateId("WHA");
// const bufferWHA = await manager.getPdf(nonNull(whaTemplateId));
// await Bun.write("wha.pdf", bufferWHA);
// console.log("WHA done");

// 1. First excel sheet
//  name/identifier: type (nda, contract, other): file url

// 2. Another excel sheet with templates

// log.info("Drive connected. Getting files...");

// // List the documents in the user's Drive
// const response = await drive.files.list({
//     pageSize: 10,
//     fields: "nextPageToken, files(id, name)",
// });

// const files = response.data.files ?? [];

// log.log(files);
// for (const file of files) console.log(`${file.name} (${file.id})`);

// const documentId = "YOUR_DOCUMENT_ID"; // Your original document ID

// // 1. Read the document
// const document = await docs.documents.get({ documentId });
// console.log("Document Title:", document.data.title);

// // 2. Create a copy of the document
// const copyResponse = await drive.files.copy({
//     fileId: documentId,
//     requestBody: {
//         name: "Copied Document", // New name for the copy
//     },
// });
// const copiedDocumentId = copyResponse.data.id!;
// console.log("Created copy with ID:", copiedDocumentId);

// // 3. Rename the copied document
// const renameResponse = await drive.files.update({
//     fileId: copiedDocumentId,
//     requestBody: {
//         name: "Renamed Copied Document",
//     },
// });
// console.log("Renamed copied document:", renameResponse.data.name);

// // 4. Modify the document content (e.g., inserting text)
// const requests = [
//     {
//         insertText: {
//             location: {
//                 index: 1, // Insert at the beginning
//             },
//             text: "Hello, this is a modified document!",
//         },
//     },
// ];
// await docs.documents.batchUpdate({
//     documentId: copiedDocumentId,
//     requestBody: { requests },
// });
// console.log("Document modified successfully!");

// // 5. Download the document as a PDF
// const pdfResponse = await drive.files.export(
//     {
//         fileId: copiedDocumentId,
//         mimeType: "application/pdf",
//     },
//     { responseType: "arraybuffer" },
// );

// // Save PDF to file
// fs.writeFileSync("document.pdf", pdfResponse.data);
// console.log("Downloaded document as PDF");
