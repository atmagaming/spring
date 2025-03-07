import { z } from "zod";
import { action } from "../action";

export const listActions = action({
    intent: "List the available actions for the user",
    args: z.object({}),
    async run({ behavior }) {
        const actions = Object.entries(behavior.actions);
        const actionsStr = actions.map(([name, action]) => `${name}: ${action.intent}`).join("\n");
        await behavior.respond(actionsStr);
    },
});
