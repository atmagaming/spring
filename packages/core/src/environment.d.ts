declare global {
    namespace NodeJS {
        interface ProcessEnv {
            BOT_TOKEN: string;
            OPENAI_API_KEY: string;
        }
    }
}

export {};
