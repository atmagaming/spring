import { di } from "@elumixor/di";
import { Databases } from "integrations/google";
import { link } from "utils";
import { Action } from "../action";

export const listPeopleAction = () =>
    new Action("listPeople", "List currently stored people and their data", {}, async (_args, { core }) => {
        const databases = di.inject(Databases);
        const people = await databases.getDatabase("People");

        let peopleStr = "";

        for (const [
            index,
            {
                name,
                data: { email, ...urls },
            },
        ] of (await people.getAll()).entries()) {
            peopleStr += `${index}. ${name} - ${email}`;

            for (const [type, url] of Object.entries(urls))
                if (((url as string | undefined) ?? "") !== "") peopleStr += ` - ${link(type.slice(0, 3), url)}`;

            peopleStr += "\n";
        }

        await core.sendMessage({ text: peopleStr.trim(), parse_mode: "HTML" });
    });
