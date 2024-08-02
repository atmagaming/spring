import "dotenv/config";
import "./utils";
import { ChatBot } from "chat-bot";
import { AiModel } from "ai-model";
import { Spring } from "spring";

const aiModel = new AiModel();
const chatBot = new ChatBot();
const spring = new Spring(chatBot, aiModel);

// Register signal handlers
process.on("SIGINT", () => {
    void spring.sleep().then(async () => {
        await chatBot.stop();
        process.exit(0);
    });
});
process.on("SIGTERM", () => {
    void spring.sleep().then(async () => {
        await chatBot.stop();
        process.exit(0);
    });
});

// Start the bot and wake up Spring
await chatBot.start();
await spring.wakeUp();
