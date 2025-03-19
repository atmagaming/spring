import { link, log } from "utils";
import { Action } from "../action";

export const listPeopleAction = () =>
    new Action("listPeople", "List currently stored people and their data", {}, async (_args, { core }) => {
        const people = core.databases.people;

        let peopleStr = "";

        log.inspect(await people.getAll());

        for (const [
            index,
            {
                name,
                data: { Email, NDA, Contract, Status },
            },
        ] of (await people.getAll()).entries()) {
            peopleStr += `${index + 1}. ${name} - ${Email}`;

            if (NDA !== "") peopleStr += `\n - ${link("NDA", NDA)}`;
            if (Contract !== "") peopleStr += `\n - ${link("Contract", Contract)}`;

            peopleStr += `\nStatus: ${Status}`;
            peopleStr += "\n\n";
        }

        await core.sendMessage({ text: peopleStr.trim(), parse_mode: "HTML" });
    });
