import { z } from "zod";
import { action } from "../action";

export const respondAction = action({
    intent: "respond to user",
    args: z.object({
        response: z.string(),
    }),
    run(ctx) {
        return ctx.behavior.respond({ text: ctx.args.response });
    },
});
