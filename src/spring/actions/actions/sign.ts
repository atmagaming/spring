import { nonNull } from "@elumixor/frontils";
import { agreementType, getFileId } from "integrations/google";
import { z } from "zod";
import { action } from "../action";
import { link } from "utils";

export const signAction = action({
    intent: "Send agreement for signing",
    args: z.object({
        agreementType,
        personName: z.string(),
    }),
    async run({ args: { agreementType, personName: name }, behavior }) {
        const { contractsManager, dropboxSign } = behavior.integrations;
        await contractsManager.init();

        log.info(`Getting the ${agreementType} link for ${name}`);
        const { [`${agreementType}Url` as const]: url, email } = contractsManager.getPerson(name) ?? {};
        if (!url) {
            log.warn(`No ${agreementType} found for ${name}`);
            await behavior.respond({ text: `No ${agreementType} found for ${name}` });
            return;
        }
        if (!email) {
            log.warn(`No email found for ${name}`);
            await behavior.respond({ text: `No email found for ${name}` });
            return;
        }

        log.info("Getting pdf file...");
        const id = getFileId(url);
        const buffer = await contractsManager.getPdf(nonNull(id));

        log.info("Sending pdf file for signing...");
        const signLink = await dropboxSign.sendFile({
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
        await behavior.respond({
            text: `File sent for signing to ${name} at ${email}:\n\n${link("Link for you to sign", nonNull(signLink))}`,
            parse_mode: "HTML",
        });
    },
});
