import { processDocument } from "integrations/algo-docs";
import { tempfile } from "utils";
import { z } from "zod";
import { action } from "../action";

export const parsePassportAction = action({
    intent: "Parse passport data",
    args: z.object({}),
    async run({ message, behavior }) {
        // Create a temporary file
        const media = await message?.photo;
        if (!media) return behavior.respond({ text: "Please attach the file" });

        const file = await tempfile(media.buffer, { fileName: media.name });
        const result = await processDocument(file);
        let response = "";
        response += "Extracted Data:\n";
        response += JSON.stringify(result.extracted, null, 2);
        response += "\nResponse:\n";
        response += String(result.response);
        response += "\nSuggestion:\n";
        response += String(result.suggestion);

        await behavior.respond({ text: response });
    },
});
