/* eslint-disable no-console */
import { FileClient } from "client";
import { promises as fs } from "fs";

// remember to use https when accesssing remote server, otherwise you will loose content/type header
const client = new FileClient("http://localhost:3150");

const fileAsBytes = await fs.readFile("tsconfig.json");

console.log(await client.readRoot());
console.log(await client.mkdir("testdir"));
await client.writeFile("testdir/test2.txt", fileAsBytes);
console.log(await client.readFile("testdir/test2.txt", "utf-8"));
console.log(await client.readRoot());
