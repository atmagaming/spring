import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export async function tempfile(
    stream: Buffer,
    {
        extension = "tmp",
        fileName = `tempfile-${Date.now()}.${extension}`,
    }: { extension?: string; fileName?: string } = {},
) {
    if (!fileName) {
        const dir = await mkdtemp(join(tmpdir(), "bun-temp-"));
        fileName = join(dir, fileName);
    }

    await Bun.write(fileName, stream);
    return fileName;
}

export async function tempname({ extension = "tmp" }: { extension?: string } = {}) {
    const dir = await mkdtemp(join(tmpdir(), "bun-temp-"));
    return join(dir, `tempfile-${Date.now()}.${extension}`);
}
