import { z } from "zod";
import { Action } from "../action";

export const databasesActions = () =>
    new Action(
        "databaseAction",
        "Perform some action on some of our Databases",
        {
            database: z.enum(["People", "Finances", "Other"]).describe("Database to use for the action"),
            action: z.enum(["Add", "Update", "Remove"]).describe("Action to perform"),
        },
        async ({ database, action }, { core }) => {
            await core.sendMessage(`You have selected action: ${action} on database: ${database}`);
        },
    );
