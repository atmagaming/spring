import { google } from "googleapis";

export class Apis {
    readonly docs;
    readonly drive;
    readonly sheets;

    constructor(private readonly auth: InstanceType<typeof google.auth.OAuth2>) {
        this.docs = google.docs({ version: "v1", auth: this.auth });
        this.drive = google.drive({ version: "v3", auth: this.auth });
        this.sheets = google.sheets({ version: "v4", auth: this.auth });
    }
}
