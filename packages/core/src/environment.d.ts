declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BOT_TOKEN: string;
            OPENAI_API_KEY: string;
            FILE_SERVER_URL: string;
        }
    }
}

export {};
