interface ImportMetaEnv {
    readonly PROD?: string;
    readonly BOT_TOKEN: string;
    readonly OPENAI_API_KEY: string;
    readonly FILE_SERVER_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
