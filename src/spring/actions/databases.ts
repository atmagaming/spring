import { z } from "zod";
import { Action } from "../action";
import { log } from "utils";

export const databasesActions = () =>
    new Action(
        "databaseAction",
        "Perform some action on some of our Databases",
        {
            database: z.enum(["People", "Finances", "Other"]).describe("Database to use for the action"),
            action: z.enum(["Add", "Update", "Remove"]).describe("Action to perform"),
            itemName: z.string().describe("Name of the item to add, update or remove"),
        },
        async ({ database, action, itemName }, { core }) => {
            log.info(`You have selected action: ${action} on database: ${database} for item: ${itemName}`);

            if (action === "Remove") {
                if (database === "People") {
                    await core.contractsManager.removePerson(itemName);
                }
            }
        },
    );
