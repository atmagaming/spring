import { action } from "spring/actions/action";
import { z } from "zod";

export const databasesActions = action({
    intent: "Perform actions on Databases",
    args: z.object({}),
    async run({ behavior, ai }) {
        // 1st step: select database
        const database = await behavior.getAnswer(
            "What database do you want to use?",
            z.enum(["People", "Finances", "Other"]),
        );

        log.log("User has selected database:", database);
        await behavior.respond(`You have selected database: ${database}`);

        // 2st step: what action would you like to take?
        const action = await behavior.getAnswer(
            "What action do you want to perform?",
            z.enum(["Add", "Update", "Remove"]),
        );

        log.log("User has selected action:", action);
        await behavior.respond(`You have selected action: ${action}`);
    },
});
