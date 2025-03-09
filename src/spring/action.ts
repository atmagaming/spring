import { di } from "@elumixor/di";
import type { Awaitable } from "@elumixor/frontils";
import { AI } from "ai";
import type { TextBotMessage } from "chat-bot";
import { zodFunction, zodResponseFormat } from "openai/helpers/zod.mjs";
import { Core } from "spring/core";
import { History } from "spring/state";
import { log } from "utils";
import { z } from "zod";

// Required arg = non-nullable
// Nullable = optional

type ZodPrimitive = z.ZodString | z.ZodNumber | z.ZodBoolean | z.ZodDate | z.ZodEnum<[string, ...string[]]>;
type ZodArgs = Record<string, ZodPrimitive | z.ZodNullable<ZodPrimitive>>;
type MapNull<T> = T extends null ? undefined : T;
type RemoveNull<T> = { [K in keyof T]: MapNull<T[K]> };
type InputFunctionArgs<T extends ZodArgs> = Partial<z.TypeOf<z.ZodObject<T>>>;
type FunctionArgs<T extends ZodArgs> = RemoveNull<z.TypeOf<z.ZodObject<T>>>;
type Abortable<T> = { aborted: true; reason: string; partialResult?: Partial<T> } | { aborted: false; result: T };

export class Action<TArgs extends ZodArgs = ZodArgs, TReturn = unknown> {
    private readonly ai = di.inject(AI);
    private readonly history = di.inject(History);
    private readonly core = di.inject(Core);

    constructor(
        readonly name: string,
        readonly description: string,
        readonly args: TArgs,
        private readonly _run: (
            args: FunctionArgs<TArgs>,
            ctx: { ai: AI; core: Core; message: TextBotMessage },
        ) => Awaitable<TReturn>,
    ) {}

    get schema() {
        return zodFunction({ name: this.name, parameters: z.object(this.args) });
    }

    get optionality() {
        const [optional, required] = Object.keys(this.args).binarySplit((key) => this.args[key].isNullable());
        return { optional, required };
    }

    // Run the action. Note that some required arguments might not be available
    async run(args: InputFunctionArgs<TArgs>, message: TextBotMessage) {
        this.fixNullArgs(args);

        // 1. Obtain args
        log.info("Getting args...");
        const argsResult = await this.getArgs(args as Partial<FunctionArgs<TArgs>>);

        // 2. Abort if could not parse args
        if (argsResult.aborted) return { aborted: true, reason: "Could not parse args" };

        // 3. Run the action with args
        log.info("Running action...");
        const result = await this._run(argsResult.result, { ai: this.ai, core: this.core, message });
        return result;
    }

    private async getArgs(args: Partial<FunctionArgs<TArgs>>): Promise<Abortable<FunctionArgs<TArgs>>> {
        let argsState = this.getArgsState(args);
        log.inspect(argsState);

        // First, ensure we have all the required args
        if (argsState.requiredMissing.nonEmpty) {
            log.info("Some required args are missing");
            // Also try to get optional args
            const newArgs = await this.getMissingArgsFromUser([
                ...argsState.requiredMissing,
                ...argsState.optionalMissing,
            ]);

            // If required cannot be retrieved, abort
            if (newArgs.aborted)
                return {
                    aborted: true,
                    reason: `Could not get required args: ${argsState.requiredMissing.join(", ")}`,
                };

            // Merge required args if retrieved
            args = { ...args, ...newArgs.result } as FunctionArgs<TArgs>;
        }

        // Update state again (we might have retrieved some optional args)
        argsState = this.getArgsState(args);

        // Try get optional args. Return if all optional args are available
        if (argsState.optionalMissing.isEmpty) return { aborted: false, result: args as FunctionArgs<TArgs> };

        const newOptional = await this.getMissingArgsFromUser(argsState.optionalMissing);

        // If optional cannot be retrieved, return what is available
        if (newOptional.aborted)
            return { aborted: false, result: { ...args, ...newOptional.partialResult } as FunctionArgs<TArgs> };

        // Merge optional args if retrieved
        return { aborted: false, result: { ...args, ...newOptional.result } as FunctionArgs<TArgs> };
    }

    private async getMissingArgsFromUser(keys: string[]): Promise<Abortable<Partial<FunctionArgs<TArgs>>>> {
        let result = {} as Partial<FunctionArgs<TArgs>>;

        log.info(`Trying to get args: ${keys.join(", ")}`);

        {
            // Check if args can be inferred from the history
            const zodFormat = z.object(Object.fromEntries(keys.map((key) => [key, this.args[key]])) as ZodArgs);

            const systemMessage = `
            Given the chat history, determine if the following arguments are available:
            ${keys.join(", ")}

            The arguments are intended for the following action:
            ${this.name}: ${this.description}

            For arguments which are not clearly available, return an empty string ''. Do not guess.
            `;

            const answer = await this.ai.client.beta.chat.completions.parse({
                model: this.ai.textModel,
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: this.history.toString() },
                ],
                response_format: zodResponseFormat(zodFormat, "answer"),
            });

            log.inspect(answer);

            const { parsed, refusal } = answer.choices.first.message;

            if (parsed === null)
                return { aborted: true, reason: "Could not infer args from history", partialResult: result };
            if (refusal !== null)
                return {
                    aborted: true,
                    reason: `Could not infer args from history: ${refusal}`,
                    partialResult: result,
                };

            // Update result
            result = { ...result, ...this.fixNullArgs(parsed as Partial<FunctionArgs<TArgs>>) };
        }

        log.inspect(result);

        // Update missing arg keys
        keys = keys.filter((key) => result[key] === undefined);

        // If no keys left, return what we have
        if (keys.isEmpty) return { aborted: false, result };

        // Otherwise, ask the user to provide more information
        await this.core.sendMessage("Please provide the following arguments: " + keys.join(", "));
        const userResponse = await this.core.getUserMessage();
        await this.history.addMessage("user", userResponse);

        {
            // Check if the user decided to abort
            const systemMessage = `
            Determine if the user has decided to abort the operation or not provide any more arguments.
            Return true if it's clear that the user has decided to not provide any more arguments.
            `;

            const answer = await this.ai.client.beta.chat.completions.parse({
                model: this.ai.textModel,
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: this.history.toString() },
                ],
                response_format: zodResponseFormat(
                    z.object({ aborted: z.boolean(), reason: z.string().nullable() }),
                    "abort",
                ),
            });

            const { parsed, refusal } = answer.choices.first.message;

            if (parsed === null)
                return { aborted: true, reason: "Could not determine abortion", partialResult: result };
            if (refusal !== null)
                return { aborted: true, reason: `Could not determine abortion: ${refusal}`, partialResult: result };

            const { aborted, reason } = parsed;
            if (aborted)
                return { aborted: true, reason: reason ?? "Could not determine abortion", partialResult: result };
        }

        // Okay, so here the user has decided NOT to abort, we can try again (recursively)
        const newArgs = await this.getMissingArgsFromUser(keys);
        if (newArgs.aborted)
            return { aborted: true, reason: newArgs.reason, partialResult: { ...result, ...newArgs.partialResult } };
        return { aborted: false, result: { ...result, ...newArgs.result } };
    }

    private getArgsState(args: Partial<FunctionArgs<TArgs>>) {
        const { required, optional } = this.optionality;

        const [requiredAvailable, requiredMissing] = required.binarySplit((key) => args[key] !== undefined);
        const [optionalAvailable, optionalMissing] = optional.binarySplit((key) => args[key] !== undefined);

        return { requiredAvailable, requiredMissing, optionalAvailable, optionalMissing };
    }

    private fixNullArgs(args: InputFunctionArgs<TArgs>) {
        for (const [key, value] of Object.entries(args))
            if (value === null || value === "" || value === "null") (args as Record<string, unknown>)[key] = undefined;

        return args as Partial<FunctionArgs<TArgs>>;
    }
}
