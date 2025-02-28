import { Client, Events, GatewayIntentBits } from "discord.js";

// Create a new Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    // intents: [],
});

// When the bot is ready
client.once(Events.ClientReady, () => {
    console.log("Bot is online!");
});

// When the bot receives a message
client.on(Events.MessageCreate, (message) => {
    console.log(message);

    if (message.content === "!ping") message.reply("Pong!");
});

// Log in with your bot's token
await client.login(import.meta.env.DISCORD_BOT_TOKEN);
