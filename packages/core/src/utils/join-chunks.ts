export async function joinChunks(chunks: AsyncIterable<string>) {
    let result = "";
    for await (const chunk of chunks) result += chunk;
    return result;
}
