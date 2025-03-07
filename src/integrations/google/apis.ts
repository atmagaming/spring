import { google } from "googleapis";
import { authorize } from "./authorize";
import { di } from "@elumixor/di";

@di.injectable
export class Apis {
    private _docs!: ReturnType<typeof google.docs>;
    private _drive!: ReturnType<typeof google.drive>;
    private _sheets!: ReturnType<typeof google.sheets>;

    async init() {
        const auth = await authorize({
            scope: ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"],
            tokenPath: "secret/google-token.json",
            credentialsPath: "secret/google-oauth-credentials.json",
        });

        this._docs = google.docs({ version: "v1", auth });
        this._drive = google.drive({ version: "v3", auth });
        this._sheets = google.sheets({ version: "v4", auth });
    }

    get docs() {
        return this._docs;
    }
    get drive() {
        return this._drive;
    }
    get sheets() {
        return this._sheets;
    }
}
