interface ImportMetaEnv {
    readonly ALGODOCS_API_KEY: string;
    readonly ALGODOCS_EMAIL: string;
    readonly ALGODOCS_EXTRACTOR_ID: string;
    readonly ALGODOCS_FOLDER_ID: string;
    readonly OPENAI_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
