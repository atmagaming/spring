interface ImportMetaEnv {
    readonly BOT_TOKEN: string;
    readonly BOT_CHAT_ID: string;
    readonly OPENAI_API_KEY: string;
    readonly FILE_SERVER_URL: string;
    readonly GOOGLE_CLIENT_ID: string;
    readonly GOOGLE_CLIENT_SECRET: string;
    readonly FILE_SERVER_URL: string;
    readonly DROPBOX_API_KEY: string;
    readonly DROPBOX_TEST_MODE: "true" | "false";
    readonly SIGNER_NAME: string;
    readonly SIGNER_EMAIL: string;
    readonly DB_DATABASES: string;
    readonly DB_PEOPLE: string;
    readonly AGREEMENTS_FOLDER: string;
    readonly ALGODOCS_API_KEY: string;
    readonly ALGODOCS_EMAIL: string;
    readonly ALGODOCS_EXTRACTOR_ID: string;
    readonly ALGODOCS_FOLDER_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
