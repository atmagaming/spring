import { z } from "zod";
import { Action } from "../action";

export const respondAction = () =>
    new Action(
        "respondAction",
        "Respond to user with a message",
        {
            message: z.string().describe("Message to respond with"),
        },
        ({ message }, { core }) => core.sendMessage(message),
    );
