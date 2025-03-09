import { OAuth2Client } from "google-auth-library";
import { log, writeJSON } from "utils";

// Check if the token is expired
export function isTokenExpired(oAuth2Client: OAuth2Client) {
    const { expiry_date } = oAuth2Client.credentials;
    return !expiry_date || Date.now() >= expiry_date;
}

// Refresh the access token using the refresh token
export async function refreshAccessToken(oAuth2Client: OAuth2Client, tokenPath: string) {
    try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);
        await writeJSON(tokenPath, credentials);
        log.info("Access token refreshed successfully");
    } catch (error) {
        log.error("Error refreshing access token:", error instanceof Error ? error.message : "");
        throw new Error("Failed to refresh access token. Re-authentication required.");
    }
}
