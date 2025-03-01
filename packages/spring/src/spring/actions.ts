import { nonNull, type Awaitable } from "@elumixor/frontils";
import type { IFileData, ISendFileData } from "chat-bot";
import { processDocument } from "integrations/algo-docs";
import { DropboxSign } from "integrations/dropbox-sign";
import { ContractsManager, getDocsUrl, getFileId } from "integrations/google-docs";
import { formatDate, tempfile, type ChunkedMessage } from "utils";
import { z } from "zod";
import type { MessageRole } from "./types";

export interface IAction<
    TArgs extends z.ZodObject<Record<string, z.ZodType>> = z.ZodObject<Record<string, z.ZodType>>,
> {
    name: string;
    intent: string;
    args: TArgs;
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}

export interface IActionContext<TArgs extends Record<string, unknown>> {
    media?: Promise<IFileData | undefined>;
    text?: string;
    args: TArgs;
    complete(text: string): PromiseLike<string> | ChunkedMessage;
    respond(message: ChunkedMessage | string): void;
    sendFile(file: ISendFileData): PromiseLike<void>;
    addToHistory(role: MessageRole, message: ChunkedMessage | string): PromiseLike<void>;
}

function action<const TArgs extends z.ZodObject<Record<string, z.ZodType>>>(options: {
    name: string;
    intent: string;
    args: TArgs;
    run(ctx: IActionContext<z.infer<TArgs>>): Awaitable;
}) {
    return options;
}

const contractsManager = new ContractsManager();
const sign = new DropboxSign();

export const actions = [
    // action({
    //     name: "log",
    //     intent: "log to server console",
    //     args: z.object({
    //         message: z.string(),
    //     }),
    //     run(ctx) {
    //         const logString = ctx.args.message;

    //         log.log(`${chalk.gray("system:")} ${logString}`);

    //         ctx.respond(`[LOG]\n${logString}`);
    //     },
    // }),
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
            issueDate: z.object({
                day: z.number(),
                month: z.number(),
                year: z.number(),
            }),
        }),
        async run(ctx) {
            await contractsManager.init();

            const name = ctx.args.name;
            ctx.respond(`Yes, I will create an NDA for ${name}:\n${JSON.stringify(ctx.args, null, 2)}`);
            const { day, month, year } = ctx.args.issueDate;
            const issueDate = formatDate(new Date(year, month - 1, day));
            const id = await contractsManager.createAgreement({ ...ctx.args, issueDate }, "NDA");

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
                fileName: `NDA ${name}.pdf`,
            });

            log.info("PDF sent successfully");
        },
    }),
    action({
        name: "sign",
        intent: "Send NDA document for signing",
        args: z.object({
            personName: z.string(),
        }),
        async run(ctx) {
            await contractsManager.init();

            const { personName: name } = ctx.args;

            log.info(`Getting the NDA link for ${name}`);
            const { NDAUrl: url, email } = contractsManager.getPerson(name) ?? {};

            if (!url) {
                log.warn(`No NDA found for ${name}`);
                ctx.respond(`No NDA found for ${name}`);
                return;
            }

            if (!email) {
                log.warn(`No email found for ${name}`);
                ctx.respond(`No email found for ${name}`);
                return;
            }

            log.info("Getting pdf file...");
            const id = getFileId(url);
            const bufferNDA = await contractsManager.getPdf(nonNull(id));

            log.info("Sending pdf file for signing...");
            const link = await sign.sendFile({
                buffer: bufferNDA,
                signer1: {
                    name: "Vladyslav Yazykov",
                    emailAddress: "ceo@atmagaming.com",
                },
                signer2: {
                    name,
                    emailAddress: email,
                },
                title: "NDA - ATMA | Hypocrisy",
                subject: "The NDA we talked about",
                message: "",
            });

            log.info("File sent");
            ctx.respond(`File sent for signing to ${name} at ${email}:\n\nLink for you to sign: ${link}`);
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
