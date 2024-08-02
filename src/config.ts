import type { SpeechCreateParams } from "openai/resources/audio/speech.mjs";
import type { ChatModel } from "openai/resources/index.mjs";

/** Maximum number of messages in the chat history */
export const maxHistorySize = 100;

export const paths = {
    history: "model-data/history.json",
    parameters: "model-data/parameters.json",
    system: {
        behavior: "model-data/system/behavior.txt",
        identity: "model-data/system/identity.txt",
        rules: "model-data/system/rules.txt",
    },
};

export const defaultTextOptions = {
    textModel: "gpt-4o-mini" as ChatModel,
};

export const defaultVoiceOptions: Omit<SpeechCreateParams, "input"> = {
    model: "tts-1",
    voice: "nova",
    response_format: "wav",
    speed: 1,
};

export const defaultTranscriptionModel = "whisper-1";

export const messageSizeLimit = 356;
