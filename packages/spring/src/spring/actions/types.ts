import type { Awaitable } from "@elumixor/frontils";
import type { TextBotMessage } from "chat-bot";
import type { BehavioralCore } from "spring/behavioral-core";
import type { z } from "zod";

export interface IAction<
    TArgs extends z.ZodObject<Record<string, z.ZodType>> = z.ZodObject<Record<string, z.ZodType>>,
> {
    intent: string;
    args: TArgs;
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}

export interface IActionContext<TArgs extends Record<string, unknown>> {
    message?: TextBotMessage;
    args: TArgs;
    behavior: BehavioralCore;
}
