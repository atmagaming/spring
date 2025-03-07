import { z } from "zod";
import { action } from "../action";

export const respondAction = action({
    intent: "Simple response to user in case no other action is reasonable",
    args: z.object({
        response: z.string(),
    }),
    run(ctx) {
        return ctx.behavior.respond({ text: ctx.args.response });
    },
});
