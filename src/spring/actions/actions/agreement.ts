import { nonNull } from "@elumixor/frontils";
import { agreementType, getDocsUrl } from "integrations/google";
import { formatDate, link, log } from "utils";
import { z } from "zod";
import { action } from "../action";

export const agreementAction = action({
    intent: "Create Agreement",
    additionalInstructions: [
        `For agreement line, the ideal case is:
            The [ROLE]: [NAME], [DOCUMENT_TYPE] [DOCUMENT_NUMBER], issued on [ISSUE_DATE] by authority [AUTHORITY].
        But if some info is not available, follow the pattern:
            The [ROLE]: [NAME], [IDENTIFICATION].
        Example of [IDENTIFICATION]: passport 123456 issued on January 1, 2000 by authority USA.
        `,
        'For NDA, the role should be "Recipient". For other contracts it should be specified by the user. Ask if not specified.',
        "If some data is missing, ask the user for more data. Do not ask for the same data multiple times.",
    ],
    args: z.object({
        agreementType,
        role: z.string(),
        identification: z.string(),
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
        infoRequestMessage: z.string().nullable(),
    }),
    async run({ args: { agreementType, role, personData, infoRequestMessage, identification }, behavior }) {
        if (infoRequestMessage !== null && infoRequestMessage !== "")
            return behavior.respond({ text: infoRequestMessage });

        const { contractsManager } = behavior.integrations;

        await contractsManager.init();

        const {
            name,
            issueDate: { day, month, year },
        } = personData;

        await behavior.respond({
            text: `Yes, I will create an ${agreementType} for ${role}, ${name}:\n\n${identification} `,
        });

        const issueDate = formatDate(new Date(year, month - 1, day));
        const id = await contractsManager.createAgreement(
            personData.name,
            { ...personData, role, issueDate },
            identification,
            agreementType,
        );

        await behavior.respond({
            text:
                `${agreementType} created: ${link("(link)", getDocsUrl(id))}\n\n` +
                `I will now send the ${agreementType} as a PDF`,
            parse_mode: "HTML",
        });

        log.info("Getting pdf file...");
        const buffer = await contractsManager.getPdf(nonNull(id));

        log.info("Sending pdf file...");
        await behavior.respond({
            file: {
                buffer,
                fileName: `${agreementType} ${name}.pdf`,
            },
            text: `${agreementType} - ${name}`,
        });

        log.info("PDF sent successfully");
    },
});
