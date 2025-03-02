import { z } from "zod";
import { action } from "../action";
import { link } from "utils";

export const listPeopleAction = action({
    intent: "List people in the database",
    args: z.object({}),
    async run({ behavior }) {
        const { contractsManager } = behavior.integrations;
        await contractsManager.init();
        const { people } = contractsManager;
        let peopleStr = "";

        for (const { name, email, index, ...filesUrls } of people.values()) {
            peopleStr += `${index}. ${name} - ${email}`;

            for (const [type, url] of Object.entries(filesUrls))
                if (((url as string | undefined) ?? "") !== "") peopleStr += ` - ${link(type.slice(0, 3), url)}`;

            peopleStr += "\n";
        }

        await behavior.respond({ text: peopleStr.trim(), parse_mode: "HTML" });
    },
});
