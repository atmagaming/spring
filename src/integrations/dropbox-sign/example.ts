import { nonNull } from "@elumixor/frontils";
import * as fs from "fs";
import open from "open";
import { DropboxSign } from "./dropbox-sign";

const sign = new DropboxSign();
const signUrl = await sign.sendFile({
    buffer: fs.readFileSync("nda.pdf"),
    signer1: {
        name: "Vladyslav Yazykov",
        emailAddress: "ceo@atmagaming.com",
    },
    signer2: {
        name: "Top Kek",
        emailAddress: "l8b3H@example.com",
    },
    title: "NDA - ATMA | Hypocrisy",
    subject: "The NDA we talked about",
    message: "Please sign this NDA and then we can discuss more. Let me know if you have any questions.",
});

await open(nonNull(signUrl));
