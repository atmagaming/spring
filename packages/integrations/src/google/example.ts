import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as readline from "readline";

// Scopes required for accessing Google Docs and Drive
const SCOPES = ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive.file"];
const TOKEN_PATH = "token.json";

// Load OAuth2 credentials and authorize
async function authorize(): Promise<OAuth2Client> {
    const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf-8"));

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if token exists
    try {
        const token = fs.readFileSync(TOKEN_PATH, "utf-8");
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    } catch (err) {
        // If no token exists, get new one using OAuth flow
        return getNewToken(oAuth2Client);
    }
}

// Get a new token by prompting for user consent
function getNewToken(oAuth2Client: OAuth2Client): Promise<OAuth2Client> {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: SCOPES,
        });
        console.log("Authorize this app by visiting this url: ", authUrl);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question("Enter the code from that page here: ", async (code: string) => {
            rl.close();
            try {
                const { tokens } = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
                resolve(oAuth2Client);
            } catch (error) {
                reject("Error while trying to retrieve access token");
            }
        });
    });
}

// Main function
async function main() {
    const auth = await authorize();
    const docs = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    const documentId = "YOUR_DOCUMENT_ID"; // Your original document ID

    // 1. Read the document
    const document = await docs.documents.get({ documentId });
    console.log("Document Title:", document.data.title);

    // 2. Create a copy of the document
    const copyResponse = await drive.files.copy({
        fileId: documentId,
        requestBody: {
            name: "Copied Document", // New name for the copy
        },
    });
    const copiedDocumentId = copyResponse.data.id!;
    console.log("Created copy with ID:", copiedDocumentId);

    // 3. Rename the copied document
    const renameResponse = await drive.files.update({
        fileId: copiedDocumentId,
        requestBody: {
            name: "Renamed Copied Document",
        },
    });
    console.log("Renamed copied document:", renameResponse.data.name);

    // 4. Modify the document content (e.g., inserting text)
    const requests = [
        {
            insertText: {
                location: {
                    index: 1, // Insert at the beginning
                },
                text: "Hello, this is a modified document!",
            },
        },
    ];
    await docs.documents.batchUpdate({
        documentId: copiedDocumentId,
        requestBody: { requests },
    });
    console.log("Document modified successfully!");

    // 5. Download the document as a PDF
    const pdfResponse = await drive.files.export(
        {
            fileId: copiedDocumentId,
            mimeType: "application/pdf",
        },
        { responseType: "arraybuffer" },
    );

    // Save PDF to file
    fs.writeFileSync("document.pdf", pdfResponse.data);
    console.log("Downloaded document as PDF");
}

main().catch(console.error);
