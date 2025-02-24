/* eslint-disable no-console */
import chalk from "chalk";
import { AlgoDocs } from "./algo-docs";
import { Processor } from "./processor";
import type { ExtractedData } from "./types";
import { createSpinner } from "nanospinner";

const algoDocs = new AlgoDocs();
const processor = new Processor();

export async function processDocument(filePath: string) {
    let id;

    // Check if it's an id
    if (/^[0-9]+$/.test(filePath)) {
        id = filePath;
    } else {
        const result = await algoDocs.uploadDocument(filePath);
        id = result.id;
    }

    let data: ExtractedData[] | undefined = undefined;

    const spinner = createSpinner("Processing document...").start();

    const maxTries = 20;
    for (let i = 0; i < maxTries; i++) {
        data = await algoDocs.getExtractedData(id);
        if (data.length > 0) break;

        spinner.update(`Waiting for document to be processed... [${i}/${maxTries}]`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (data === undefined || data.length === 0) {
        spinner.stop();
        throw new Error("Document processing timed out");
    }

    spinner.success("Document processed successfully");

    spinner.start("Processing with AI...");
    const result = await processor.process(data);
    spinner.success("Processed successfully");

    return result;
}

// Command-line execution logic
if (require.main === module) {
    // This block runs if the file is executed directly
    const filePath = process.argv[2]; // Get the file path from the command line
    if (!filePath) {
        console.error(chalk.red("Please provide a file path."));
        process.exit(1);
    }

    try {
        const result = await processDocument(filePath);
        console.log("Extracted Data:");
        console.log(result.extracted);
        console.log("Response:");
        console.log(result.response);
        console.log("Suggestion:");
        console.log(result.suggestion);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error processing document:", error);
        process.exit(1);
    }
}
