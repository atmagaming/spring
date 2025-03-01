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

const agreementType = z.enum(["NDA", "WHA"] as const);

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
        intent: "Create Agreement",
        args: z.object({
            agreementType,
            personData: z.object({
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
        }),
        async run(ctx) {
            await contractsManager.init();

            const { agreementType, personData } = ctx.args;
            const {
                name,
                issueDate: { day, month, year },
                ...rest
            } = personData;

            const issueDate = formatDate(new Date(year, month - 1, day));
            ctx.respond(
                `Yes, I will create an ${agreementType} for ${name}:\n${Object.entries({ ...rest, issueDate })
                    .map(([key, value]) => `  ${key}: ${value}`)
                    .join("\n")}`,
            );
            const id = await contractsManager.createAgreement({ ...personData, issueDate }, agreementType);

            ctx.respond(
                `${agreementType} created with id: ${id}\nHere's the link to the file:\n\n${getDocsUrl(id)}\n\n` +
                    `I will now send the ${agreementType} as a PDF`,
            );

            log.info("Getting pdf file...");
            const buffer = await contractsManager.getPdf(nonNull(id));

            log.info("Sending pdf file...");
            await ctx.sendFile({
                buffer,
                caption: `${agreementType} - ${name}`,
                fileName: `${agreementType} ${name}.pdf`,
            });

            log.info("PDF sent successfully");
        },
    }),
    action({
        name: "sign",
        intent: "Send agreement for signing",
        args: z.object({
            agreementType,
            personName: z.string(),
        }),
        async run(ctx) {
            await contractsManager.init();

            const { personName: name, agreementType } = ctx.args;

            log.info(`Getting the ${agreementType} link for ${name}`);
            const { [`${agreementType}Url` as const]: url, email } = contractsManager.getPerson(name) ?? {};

            if (!url) {
                log.warn(`No ${agreementType} found for ${name}`);
                ctx.respond(`No ${agreementType} found for ${name}`);
                return;
            }

            if (!email) {
                log.warn(`No email found for ${name}`);
                ctx.respond(`No email found for ${name}`);
                return;
            }

            log.info("Getting pdf file...");
            const id = getFileId(url);
            const buffer = await contractsManager.getPdf(nonNull(id));

            log.info("Sending pdf file for signing...");
            const link = await sign.sendFile({
                buffer,
                signer1: {
                    name: import.meta.env.SIGNER_NAME,
                    emailAddress: import.meta.env.SIGNER_EMAIL,
                },
                signer2: {
                    name,
                    emailAddress: email,
                },
                title: `${agreementType} - ATMA | Hypocrisy`,
                subject: `The ${agreementType} we talked about`,
                message: "",
            });

            log.info("File sent");
            ctx.respond(`File sent for signing to ${name} at ${email}:\n\nLink for you to sign: ${link}`);
        },
    }),
    action({
        name: "remove person",
        intent: "Remove person from the database",
        args: z.object({
            personName: z.string(),
        }),
        async run(ctx) {
            await contractsManager.init();

            const { personName } = ctx.args;
            await contractsManager.removePerson(personName);
            ctx.respond(`Person ${personName} removed from database`);
        },
    }),
    action({
        name: "list people",
        intent: "List people in the database",
        args: z.object({}),
        async run(ctx) {
            await contractsManager.init();
            const { people } = contractsManager;

            let peopleStr = "";
            //  {
            for (const { name, email, index, ..._filesUrls } of people.values())
                peopleStr += `${index}. ${name} - ${email}\n`;
            // for (const [type, url] of Object.entries(filesUrls)) peopleStr += `  ${type}: ${url}\n`;
            // }

            ctx.respond(peopleStr);
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
