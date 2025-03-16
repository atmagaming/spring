import { di } from "@elumixor/di";
import { google } from "googleapis";
import { log } from "utils";
import { authorize } from "./auth/authorize";

@di.injectable
export class Apis {
    private _docs!: ReturnType<typeof google.docs>;
    private _drive!: ReturnType<typeof google.drive>;
    private _sheets!: ReturnType<typeof google.sheets>;

    async init() {
        log.debug("Authorizing Google APIs");

        const auth = await authorize({
            scope: [
                "https://www.googleapis.com/auth/documents",
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/spreadsheets",
            ],
            tokenPath: "secret/google-token.json",
            credentialsPath: "secret/google-oauth-credentials.json",
        });

        this._docs = google.docs({ version: "v1", auth });
        this._drive = google.drive({ version: "v3", auth });
        this._sheets = google.sheets({ version: "v4", auth });

        log.debug("Authorized Google APIs");
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
