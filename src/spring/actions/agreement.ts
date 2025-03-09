import { nonNull } from "@elumixor/frontils";
import { agreementType, getDocsUrl } from "integrations/google";
import { formatDate, link, log } from "utils";
import { z } from "zod";
import { Action } from "../action";

export const agreementAction = () =>
    new Action(
        "createAgreement",
        "Create a new agreement for the person",
        {
            agreementType,
            role: z
                .string()
                .describe(
                    "Role of the person to create the agreement for. If the agreement type is NDA, the role is automatically set to 'Recipient'",
                ),
            name: z.string().describe("Full name of the person to create the agreement for"),
            email: z.string(),
            idType: z.string().describe("Type of ID. For example, passport or residence permit"),
            idNumber: z.string().describe("The number of ID"),
            authority: z.string().describe("The authority that issued the ID. For example, 8032, or USA"),
            issueDate: z
                .string()
                .nullable()
                .describe(
                    "The date when the ID was issued. The format is DD/MM/YYYY. For example, 20/03/2023. " +
                        "It can be missing - in such cases put null.",
                ),
            expirationDate: z.string().nullable().describe("The expiration date of the agreement"),
        },
        async ({ agreementType, role, name, ...personData }, { core, ai }) => {
            const { contractsManager } = core.integrations;

            await contractsManager.init();

            await core.sendMessage(`Creating ${agreementType} for ${role} ${name}`);

            let issueDate;
            if (personData.issueDate) {
                const [day, month, year] = personData.issueDate.split("/").map(Number);
                issueDate = formatDate(new Date(year, month - 1, day));
            }

            const identification = await ai.textCompletion(`
            Create an identification for the person:
            Name: ${name}
            Document type: ${personData.idType}
            Document number: ${personData.idNumber}
            Authority: ${personData.authority}
            Issue date: ${issueDate}
            Expiration date: ${personData.expirationDate}

            The identification should ideally be in the following format:
            "[DOCUMENT_TYPE] [DOCUMENT_NUMBER], issued on [ISSUE_DATE] by authority [AUTHORITY]"
            Example: "passport 123456789, issued on January 1, 2000 by authority 1234"

            Make sure the identification is formatted correctly and has no spelling or grammar errors.
            Do not end the identification with a period or a comma.

            If some data is missing, create an identification without it as best as possible.
            However, do not put non-existent data - do not guess.`);

            const id = await contractsManager.createAgreement(
                name,
                { ...personData, role, issueDate },
                identification,
                agreementType,
            );

            await core.sendMessage({
                text:
                    `${agreementType} created: ${link("(link)", getDocsUrl(id))}\n\n` +
                    `I will now send the ${agreementType} as a PDF`,
                parse_mode: "HTML",
            });

            log.info("Getting pdf file...");
            const buffer = await contractsManager.getPdf(nonNull(id));

            log.info("Sending pdf file...");
            await core.sendMessage({
                file: {
                    buffer,
                    fileName: `${agreementType} ${name}.pdf`,
                },
                text: `${agreementType} - ${name}`,
            });

            log.info("PDF sent successfully");
        },
    );
