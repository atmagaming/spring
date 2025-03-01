import { z } from "zod";
import { action } from "../action";

export const listPeopleAction = action({
    intent: "List people in the database",
    args: z.object({}),
    async run({ behavior }) {
        const { contractsManager } = behavior.integrations;
        await contractsManager.init();
        const { people } = contractsManager;
        let peopleStr = "";

        //  {
        for (const { name, email, index, ..._filesUrls } of people.values())
            peopleStr += `${index}. ${name} - ${email}\n`;

        // for (const [type, url] of Object.entries(filesUrls)) peopleStr += `  ${type}: ${url}\n`;
        // }
        await behavior.respond({ text: peopleStr });
    },
});
