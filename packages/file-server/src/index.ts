import { serve } from "bun";
import { RequestHandler } from "request-handler";

const server = new RequestHandler({
    port: 3150,
    baseDir: "./files",
});

serve({
    async fetch(req) {
        return server.fetch(req);
    },
    port: server.port,
});

// eslint-disable-next-line no-console
console.log(`Server running on http://localhost:${server.port}`);
