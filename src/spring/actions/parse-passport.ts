import { processDocument } from "integrations/algo-docs";
import { tempfile } from "utils";
import { Action } from "../action";

export const parsePassportAction = () =>
    new Action("parsePassport", "Parse passport data from the image", {}, async (_args, { message, core }) => {
        // Create a temporary file
        const media = await message.photo;
        if (!media) return core.sendMessage("Please attach the file");

        const file = await tempfile(media.buffer, { fileName: media.name });
        const result = await processDocument(file);
        let response = "";
        response += "Extracted Data:\n";
        response += JSON.stringify(result.extracted, null, 2);
        response += "\nResponse:\n";
        response += String(result.response);
        response += "\nSuggestion:\n";
        response += String(result.suggestion);

        await core.sendMessage(response);
    });
