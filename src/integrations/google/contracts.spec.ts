import { describe, it } from "bun:test";
import { Apis } from "./apis";
import { Databases } from "./databases";
import { ContractsManager } from "./contracts-manager";

describe("contracts manager", () => {
    it(
        "should work",
        async () => {
            await new Apis().init();
            new Databases();

            const contractsManager = new ContractsManager();
            await contractsManager.init();

            const doc = await contractsManager.fromTemplate("Mariya Kostina", "NDA");
            await doc.remove();
        },
        { timeout: 1000000 },
    );
});
