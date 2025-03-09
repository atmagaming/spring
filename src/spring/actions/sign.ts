import { nonNull } from "@elumixor/frontils";
import { agreementType, getFileId } from "integrations/google";
import { link, log } from "utils";
import { z } from "zod";
import { Action } from "../action";

export const signAction = () =>
    new Action(
        "signAgreement",
        "Send an agreement for signing",
        {
            agreementType,
            personName: z.string(),
        },
        async ({ agreementType, personName: name }, { core }) => {
            const { contractsManager, dropboxSign } = core.integrations;
            await contractsManager.init();

            log.info(`Getting the ${agreementType} link for ${name}`);

            const agreementProperty = agreementType === "NDA" ? "ndaUrl" : "contractUrl";
            const { [agreementProperty]: url, email } = await contractsManager.getPerson(name);

            if (!url) {
                log.warn(`No ${agreementType} found for ${name}`);
                await core.sendMessage(`No ${agreementType} found for ${name}`);
                return;
            }

            if (!email) {
                log.warn(`No email found for ${name}`);
                await core.sendMessage(`No email found for ${name}`);
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
            await core.sendMessage({
                text: `File sent for signing to ${name} at ${email}:\n\n${link("Link for you to sign", nonNull(signLink))}`,
                parse_mode: "HTML",
            });
        },
    );
