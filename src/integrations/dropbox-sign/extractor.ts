import { getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

export class Extractor {
    numPages = 0;
    width = 0;
    height = 0;

    private items = [] as TextItem[];

    async init(fileBuffer: Buffer) {
        const data = new Uint8Array(fileBuffer);
        const pdf = await getDocument({ data }).promise;
        this.numPages = pdf.numPages;
        const lastPage = await pdf.getPage(this.numPages);

        const { width, height } = lastPage.getViewport({ scale: 1 });
        this.width = width;
        this.height = height;

        this.items = (await lastPage.getTextContent()).items as TextItem[];
    }

    getBox(name: string) {
        const item = this.items.find((item) => item.str === name);
        if (item === undefined) throw new Error(`Could not find the box: ${name}`);

        const transform = item.transform as number[];

        const w = item.width / this.width;
        const h = item.height / this.height;

        const x = transform[4] / this.width;

        // Y start from the bottom, hence 1 - ...
        // Additionally, we subtract the field height
        const y = 1 - transform[5] / this.height - h;

        return {
            x,
            y,
            width: w,
            height: h,
        };
    }
}
