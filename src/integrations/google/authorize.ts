import { nonNull } from "@elumixor/frontils";
import { serve } from "bun";
import chalk from "chalk";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import open from "open";
import { readJSON, writeJSON } from "utils";

// Load OAuth2 credentials and authorize
export async function authorize({
    scope,
    credentialsPath,
    tokenPath,
}: {
    scope: string[];
    credentialsPath: string;
    tokenPath: string;
}) {
    // Read OAuth2 credentials
    const {
        web: {
            client_id,
            client_secret,
            redirect_uris: { first: redirect_uri },
        },
    } = await readJSON<{
        web: {
            client_id: string;
            client_secret: string;
            redirect_uris: string[];
        };
    }>(credentialsPath);

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

    // Try existing token
    try {
        oAuth2Client.setCredentials(await readJSON(tokenPath));
        return oAuth2Client;
    } catch (err) {
        // If no token exists, get new one using OAuth flow
        log.warn(`${chalk.yellow("Google OAuth:")} Saved token not available, getting new one`);

        // Extract port from the redirect uri
        const port = redirect_uri.match(/:\d+/)?.[0].slice(1);

        const auth = await getNewToken(oAuth2Client, nonNull(port), scope, tokenPath);
        log.info("Authorization completed");
        return auth;
    }
}

// Get a new token by prompting for user consent
function getNewToken(oAuth2Client: OAuth2Client, port: string, scope: string[], tokenPath: string) {
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
