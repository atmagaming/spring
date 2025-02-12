import { Bot } from "grammy";

const bot = new Bot(import.meta.env.BOT_TOKEN);

bot.on("message:text", (ctx) =>
    // eslint-disable-next-line no-console
    console.log(`ChatId: ${ctx.chatId}`),
);

void bot.start();

// eslint-disable-next-line no-console
console.log("Send a message to the bot to get the chat id");
