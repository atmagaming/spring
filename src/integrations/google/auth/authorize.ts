import { nonNull } from "@elumixor/frontils";
import chalk from "chalk";
import { google } from "googleapis";
import { log, readJSON, writeJSON } from "utils";
import { getNewToken } from "./get-new-token";
import { isTokenExpired, refreshAccessToken } from "./refresh";

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
        const token = await readJSON<Parameters<typeof oAuth2Client.setCredentials>[0]>(tokenPath);
        oAuth2Client.setCredentials(token);

        log.info("Using existing token");

        // Automatically refresh token if needed
        oAuth2Client.on("tokens", (tokens) => {
            if (tokens.refresh_token) {
                token.refresh_token = tokens.refresh_token;
            }
            token.access_token = tokens.access_token;
            void writeJSON(tokenPath, token);
        });

        if (isTokenExpired(oAuth2Client)) {
            log.info("Access token expired. Refreshing...");
            await refreshAccessToken(oAuth2Client, tokenPath);
        } else {
            log.info("Using existing valid token");
        }

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
