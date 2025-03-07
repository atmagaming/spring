import type { Awaitable } from "@elumixor/frontils";
import type { z } from "zod";
import type { IAction, IActionContext } from "./types";

// export function action(options: {
//     intent: string;
//     additionalInstructions?: string[];
//     run(ctx: IActionContext<Record<string, never>>): Awaitable;
// }): IAction<z.ZodObject<Record<string, z.ZodNever>>>;
export function action<const TArgs extends z.ZodObject<Record<string, z.ZodType>>>(options: {
    intent: string;
    args: TArgs;
    additionalInstructions?: string[];
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}): IAction<TArgs>;
export function action<const TArgs extends z.ZodObject<Record<string, z.ZodType>>>(options: {
    intent: string;
    args: TArgs;
    additionalInstructions?: string[];
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}) {
    return options;
}
