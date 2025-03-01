import { nonNull } from "@elumixor/frontils";
import { agreementType, getDocsUrl } from "integrations/google-docs";
import { formatDate } from "utils";
import { z } from "zod";
import { action } from "../action";

export const agreementAction = action({
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
    async run({ args: { agreementType, personData }, behavior }) {
        const { contractsManager } = behavior.integrations;

        await contractsManager.init();

        const {
            name,
            issueDate: { day, month, year },
            ...rest
        } = personData;

        const issueDate = formatDate(new Date(year, month - 1, day));
        await behavior.respond({
            text: `Yes, I will create an ${agreementType} for ${name}:\n${Object.entries({ ...rest, issueDate })
                .map(([key, value]) => `  ${key}: ${value}`)
                .join("\n")}`,
        });

        const id = await contractsManager.createAgreement({ ...personData, issueDate }, agreementType);

        await behavior.respond({
            text:
                `${agreementType} created with id: ${id}\nHere's the link to the file:\n\n${getDocsUrl(id)}\n\n` +
                `I will now send the ${agreementType} as a PDF`,
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
