import { z } from "zod";
import { action } from "../action";

export const removePersonAction = action({
    intent: "Remove person from the database",
    args: z.object({
        personName: z.string(),
    }),
    async run({ args: { personName }, behavior }) {
        const { contractsManager } = behavior.integrations;
        await contractsManager.init();
        await contractsManager.removePerson(personName);
        await behavior.respond({ text: `Person ${personName} removed from database` });
    },
});
