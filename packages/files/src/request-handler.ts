import { FileHandler } from "file-handler";

export class RequestHandler {
    readonly port;
    readonly baseDir; // base directory for the file server
    private fileHandler;
    private initPromise;

    constructor({ port = 3150, baseDir = "./" } = {}) {
        this.port = port;
        this.baseDir = baseDir;
        this.fileHandler = new FileHandler(this.baseDir);
        this.initPromise = this.fileHandler.init();
    }

    async fetch(req: Request) {
        try {
            await this.initPromise;

            const url = new URL(req.url);
            const pathname = url.pathname;

            // eslint-disable-next-line no-console
            console.log(`Request: ${pathname}`);

            if (pathname === "/tree") {
                const tree = await this.fileHandler.getTree();
                return new Response(JSON.stringify(tree), { headers: { "Content-Type": "application/json" } });
            }

            if (pathname === "/exists") {
                const { id } = (await req.json()) as { id?: string };
                if (!id) return new Response("Bad Request. Missing 'id' field", { status: 400 });

                const exists = await this.fileHandler.exists(id);
                return new Response(JSON.stringify({ exists }), { headers: { "Content-Type": "application/json" } });
            }

            if (pathname === "/read") {
                const { id } = (await req.json()) as { id?: string };
                if (!id) return new Response("Bad Request. Missing 'id' field", { status: 400 });

                const content = await this.fileHandler.readFile(id);
                return new Response(content);
            }

            if (pathname === "/write") {
                // Show headers
                // eslint-disable-next-line no-console
                console.log(req.headers);

                // Parse form data from the request
                const formData = await req.formData();
                const id = formData.get("id");
                const content = formData.get("content");

                if (!id || !content)
                    return new Response("Bad Request. Missing 'id' or 'content' field", { status: 400 });

                if (typeof id !== "string" || !(content instanceof Blob))
                    return new Response("Bad Request. Invalid 'id' or 'content' field", { status: 400 });

                await this.fileHandler.writeFile(id, new Uint8Array(await content.arrayBuffer()));
                return new Response("OK");
            }

            if (pathname === "/mkdir") {
                const { id } = (await req.json()) as { id?: string };
                if (!id) return new Response("Bad Request. Missing 'id' field", { status: 400 });

                await this.fileHandler.mkdir(id);
                return new Response("OK");
            }

            if (pathname === "/delete") {
                const { id } = (await req.json()) as { id?: string };
                if (!id) return new Response("Bad Request. Missing 'id' field", { status: 400 });

                await this.fileHandler.delete(id);
                return new Response("OK");
            }

            return new Response("Not Found", { status: 404 });
        } catch (error) {
            if (error instanceof Error) {
                // eslint-disable-next-line no-console
                console.error(error);
                return new Response(error.message, {
                    status: 500,
                    statusText: `${error.name}: ${error.message}`,
                });
            }

            return new Response("Internal Server Error", { status: 500 });
        }
    }
}
