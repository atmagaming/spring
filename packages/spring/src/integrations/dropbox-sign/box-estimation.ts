import type { Extractor } from "./extractor";

export function estimateBox({ name, emailAddress }: { name: string; emailAddress: string }, extractor: Extractor) {
    const nameBox = extractor.getBox(name);
    const emailBox = extractor.getBox(emailAddress);
    const lineDiff = emailBox.y - nameBox.y;

    // Form the box with 2 lines height
    return scaled({
        x: nameBox.x,
        width: 0.25,
        y: nameBox.y - 1.5 * lineDiff,
        height: nameBox.height * 2,
    });
}

export function scaled({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
    // dropbox sign has strange system of scaling...
    // https://faq.hellosign.com/hc/en-us/articles/217115577-How-to-use-the-Form-Fields-Per-Document-parameter
    const editorWidth = 612;
    const editorHeight = 792;

    return {
        x: x * editorWidth,
        y: y * editorHeight,
        width: width * 1.111 * editorWidth,
        height: height * 1.111 * editorHeight,
    };
}
