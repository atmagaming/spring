import { describe, expect, it } from "bun:test";
import { authorize } from "./authorize";

describe("google auth", () => {
    it(
        "should work",
        async () => {
            const auth = await authorize({
                scope: [
                    "https://www.googleapis.com/auth/documents",
                    "https://www.googleapis.com/auth/drive",
                    "https://www.googleapis.com/auth/spreadsheets",
                ],
                tokenPath: "secret/google-token.json",
                credentialsPath: "secret/google-oauth-credentials.json",
            });

            expect(auth).toBeDefined();
        },
        { timeout: 100000 },
    );
});
