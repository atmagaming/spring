import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import z from "zod";
import type { ExtractedData } from "./types";

export class Processor {
    private readonly ai = new OpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });
    readonly zodSchema = z.object({
        name: z.nullable(z.string()),
        passport: z.nullable(z.string()),
        authority: z.nullable(z.string()),
        issueDate: z.nullable(z.string()),
        expirationDate: z.nullable(z.string()),
        address: z.nullable(z.string()),
    });

    readonly responseFormat = zodResponseFormat(this.zodSchema, "passport_data");
    private readonly systemMessage = `Extract the passport data from the given json file. If the data is missing, return null.`;

    async extract(data: ExtractedData[]) {
        const merged = data
            .map((el) =>
                Object.entries(el.data)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n"),
            )
            .join("\n");

        const result = await this.ai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            response_format: this.responseFormat,
            messages: [
                { role: "system", content: this.systemMessage },
                { role: "user", content: merged },
            ],
        });

        return result.choices[0].message.parsed;
    }

    async formResponse(extracted: z.infer<typeof this.zodSchema>) {
        const expirationDate = extracted.expirationDate;
        const isOutdated = expirationDate !== null && new Date() > new Date(expirationDate);

        const extractedString = JSON.stringify({ ...extracted, isOutdated });

        const result = await this.ai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                    You will receive the parsed data from the client's passport. Some data may be missing.
                    Create a response to the client thanking for provided data and/or asking for additional data if something is missing.
                    Be concise, respectful, and assertive. Also check if the passport is outdated (isOutdated) field - in such case point it out and ask for the new document.

                    Example when all fields are found:
                    Hi, [short name (if found)]! Thanks for ... (fill in)!"

                    Example when some fields are missing:
                    Hi, [short name (if found)]! Thanks for ... (fill in)! However I couldn't find:
                    - ... (fill in missing fields) - (description of the field - what it means)
                    ...

                    Thanks!

                    Example when the passport is outdated:
                    Hi, [short name (if found)]! Thanks for ... (fill in)! However, it looks like your passport is outdated.
                    Please provide a new one.
                    `,
                },
                { role: "user", content: extractedString },
            ],
        });

        return result.choices[0].message.content;
    }

    async formSuggestion(extracted: z.infer<typeof this.zodSchema>) {
        const extractedString = JSON.stringify(extracted);

        const result = await this.ai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                    You will receive the parsed data from the client's passport. Some data may be missing.
                    Use what you have to create their identity string for the NDA.
                    You only need name, passport, authority number and date, and address.
                    Disregard all other data.

                    Example with all fields:
                    John Doe, passport 123456789, issued by authority 1234 on January 1, 2000 residing at 123 Main St, Anytown, CA 12345.
                    `,
                },
                { role: "user", content: extractedString },
            ],
        });

        return result.choices[0].message.content;
    }

    async process(data: ExtractedData[]) {
        const extracted = (await this.extract(data)) ?? {
            name: null,
            passport: null,
            authority: null,
            issueDate: null,
            expirationDate: null,
            address: null,
        };

        const [response, suggestion] = await Promise.all([
            this.formResponse(extracted),
            this.formSuggestion(extracted),
        ]);

        const isError = Object.values(extracted).some((el) => el === null);

        return { extracted, response, suggestion, isError };
    }
}
