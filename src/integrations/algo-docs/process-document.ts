import chalk from "chalk";
import { AlgoDocs } from "./algo-docs";
import { Processor } from "./processor";
import type { ExtractedData } from "./types";
import { createSpinner } from "nanospinner";
import { log } from "utils";

const algoDocs = new AlgoDocs();
const processor = new Processor();

export async function processDocument(filePath: string) {
    let id;

    // Check if it's an id
    if (/^[0-9]+$/.test(filePath)) {
        id = filePath;
    } else {
        log.debug("uploading");
        const result = await algoDocs.uploadDocument(filePath);

        log.debug("done");
        id = result.id;
    }

    let data: ExtractedData[] | undefined = undefined;

    const spinner = createSpinner("Processing document...").start();

    const maxTries = 20;
    for (let i = 0; i < maxTries; i++) {
        log.debug(`Attempt ${i + 1}/${maxTries}`);
        data = await algoDocs.getExtractedData(id);
        if (data.length > 0) break;

        spinner.update(`Waiting for document to be processed... [${i}/${maxTries}]`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    log.debug("YES");

    if (data === undefined || data.length === 0) {
        spinner.stop();
        throw new Error("Document processing timed out");
    }

    spinner.success("Document processed successfully");

    log.debug("processing with AI...");
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
        log.error(chalk.red("Please provide a file path."));
        process.exit(1);
    }

    try {
        const result = await processDocument(filePath);
        log.debug("Extracted Data:");
        log.debug(result.extracted);
        log.debug("Response:");
        log.debug(result.response);
        log.debug("Suggestion:");
        log.debug(result.suggestion);
    } catch (error) {
        log.error("Error processing document:", error);
        process.exit(1);
    }
}
