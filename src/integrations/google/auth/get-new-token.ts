import { serve } from "bun";
import type { OAuth2Client } from "google-auth-library";
import open from "open";
import { log, writeJSON } from "utils";

// Get a new token by prompting for user consent
export function getNewToken(oAuth2Client: OAuth2Client, port: string, scope: string[], tokenPath: string) {
    return new Promise<OAuth2Client>((resolve, reject) => {
        const server = serve({
            port,
            async fetch(req) {
                const url = new URL(req.url);
                const authUrl = oAuth2Client.generateAuthUrl({
                    access_type: "offline",
                    scope,
                });

                if (url.pathname === "/")
                    return new Response(`<a href="${authUrl}">Authorize with Google</a>`, {
                        headers: { "Content-Type": "text/html" },
                    });

                if (url.pathname === "/oauth2callback") {
                    const code = url.searchParams.get("code");
                    if (!code) return new Response("Authorization code not found", { status: 400 });

                    try {
                        const { tokens } = await oAuth2Client.getToken(code);
                        oAuth2Client.setCredentials(tokens);
                        await writeJSON(tokenPath, tokens);

                        resolve(oAuth2Client);
                        return new Response(
                            "Authorization successful! You can now use the Google Docs API.\nYou can close this window.",
                        );
                    } catch (error) {
                        log.error("Error exchanging code for tokens:", error);
                        reject(new Error("Error exchanging code for tokens"));
                        return new Response("Authentication failed", { status: 500 });
                    }
                }

                return new Response("Not Found", { status: 404 });
            },
        });

        log.info(`Server running at http://localhost:${server.port}`);
        void open(`http://localhost:${server.port}`);
    });
}
