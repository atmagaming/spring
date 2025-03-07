import "dotenv/config";
import "./utils";
import { ChatBot } from "chat-bot";
import { AI } from "ai";
import { Spring } from "spring";
import { Databases, Apis } from "integrations/google";

new AI();
new ChatBot();
await new Apis().init();
new Databases();

const spring = new Spring();

// Register signal handlers
process.on("SIGINT", () => void spring.sleep().then(() => process.exit(0)));
process.on("SIGTERM", () => void spring.sleep().then(() => process.exit(0)));

// Start the bot and wake up Spring
await spring.wakeUp();
