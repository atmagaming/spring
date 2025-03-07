import { Apis } from "../apis";
import { Databases } from "./databases";

// ---------------------
await new Apis().init();

const dbs = new Databases();

await dbs.refreshMetadata();

// console.log(dbs.keys, dbs.properties);
// console.log(await dbs.get(dbs.keys.first));
// console.log((await dbs.get(dbs.keys.first)).URL);
// await dbs.rename("Databases 2", "Databases");
await dbs.add("Agreements 2", { url: "myurl", test: "hello world" });
// await dbs.addProperty("test");
// await dbs.removeProperty("Top Kek 2");
// await dbs.removeProperty("Top Kek 2");
// await dbs.renameProperty("Column 3", "TOP KEK");
// await dbs.delete("Agreements");
await dbs.update("Agreements 2", { url: null });

// console.log(dbs.columnLetter(0));
// console.log(dbs.columnLetter(1));
// console.log(dbs.columnLetter(2));
