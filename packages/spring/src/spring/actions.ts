import { nonNull, type Awaitable } from "@elumixor/frontils";
import chalk from "chalk";
import type { IFileData, ISendFileData } from "chat-bot";
import { processDocument } from "integrations/algo-docs";
import { ContractsManager, getDocsUrl } from "integrations/google-docs";
import { tempfile, type ChunkedMessage } from "utils";
import { z } from "zod";
import type { MessageRole } from "./types";

export interface IAction<
    TArgs extends z.ZodObject<Record<string, z.ZodString>> = z.ZodObject<Record<string, z.ZodString>>,
> {
    name: string;
    intent: string;
    args: TArgs;
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}

export interface IActionContext<TArgs extends Record<string, string>> {
    media?: Promise<IFileData | undefined>;
    text?: string;
    args: TArgs;
    complete(text: string): PromiseLike<string> | ChunkedMessage;
    respond(message: ChunkedMessage | string): void;
    sendFile(file: ISendFileData): PromiseLike<void>;
    addToHistory(role: MessageRole, message: ChunkedMessage | string): PromiseLike<void>;
}

function action<const TArgs extends z.ZodType<Record<string, string>>>(options: {
    name: string;
    intent: string;
    args: TArgs;
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}) {
    return options;
}

const contractsManager = new ContractsManager();

export const actions = [
    action({
        name: "log",
        intent: "log to server console",
        args: z.object({
            message: z.string(),
        }),
        run(ctx) {
            const logString = ctx.args.message;

            log.log(`${chalk.gray("system:")} ${logString}`);

            ctx.respond(`[LOG]\n${logString}`);
        },
    }),
    action({
        name: "respond",
        intent: "respond to user",
        args: z.object({
            response: z.string(),
        }),
        run(ctx) {
            ctx.respond(ctx.args.response);
        },
    }),
    action({
        name: "nda",
        intent: "Create NDA",
        args: z.object({
            name: z.string(),
            email: z.string(),
            passport: z.string(),
            authority: z.string(),
            issueDate: z.string(),
        }),
        async run(ctx) {
            await contractsManager.init();

            const name = ctx.args.name;
            ctx.respond(`Yes, I will create an NDA for ${name}:\n${JSON.stringify(ctx.args, null, 2)}`);
            const id = await contractsManager.createAgreement(ctx.args, "NDA");

            ctx.respond(
                `NDA created with id: ${id}\nHere's the link to the file:\n\n${getDocsUrl(id)}\n\n` +
                    "I will now send the NDA as a PDF",
            );

            log.info("Getting pdf file...");
            const bufferNDA = await contractsManager.getPdf(nonNull(id));

            log.info("Sending pdf file...");
            await ctx.sendFile({
                buffer: bufferNDA,
                caption: `NDA - ${name}`,
                fileName: `${name}.pdf`,
            });
            log.info("PDF sent successfully");
        },
    }),
    action({
        name: "passport",
        intent: "Parse passport data",
        args: z.object({}),
        async run(ctx) {
            // Create a temporary file
            const media = await ctx.media;
            if (!media) {
                ctx.respond("Please attach the file");
                return;
            }

            const file = await tempfile(media.buffer, { fileName: media.name });

            const result = await processDocument(file);

            let response = "";
            response += "Extracted Data:\n";
            response += JSON.stringify(result.extracted, null, 2);
            response += "\nResponse:\n";
            response += String(result.response);
            response += "\nSuggestion:\n";
            response += String(result.suggestion);

            ctx.respond(response);
        },
    }),
] as const satisfies IAction[];
