import type { Awaitable } from "@elumixor/frontils";
import type { z } from "zod";
import type { IActionContext } from "./types";

export function action<const TArgs extends z.ZodObject<Record<string, z.ZodType>>>(options: {
    intent: string;
    args: TArgs;
    additionalInstructions?: string[];
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}) {
    return options;
}
