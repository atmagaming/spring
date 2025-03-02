import {
    SignatureRequestApi,
    SubSignatureRequestSigner,
    SubSigningOptions,
    type RequestDetailedFile,
} from "@dropbox/sign";
import { estimateBox } from "./box-estimation";
import { Extractor } from "./extractor";

export class DropboxSign {
    private readonly api = new SignatureRequestApi();
    private readonly extractor = new Extractor();

    constructor() {
        this.api.username = import.meta.env.DROPBOX_API_KEY;
    }

    async sendFile({
        buffer,
        signer1,
        signer2,
        title,
        subject,
        message,
    }: {
        buffer: Buffer;
        signer1: SubSignatureRequestSigner;
        signer2: SubSignatureRequestSigner;
        title: string;
        subject: string;
        message: string;
    }) {
        await this.extractor.init(buffer);

        const signingOptions: SubSigningOptions = {
            draw: true,
            type: true,
            upload: true,
            phone: false,
            defaultType: SubSigningOptions.DefaultTypeEnum.Draw,
        };

        // or, upload from buffer
        const file: RequestDetailedFile = {
            value: buffer,
            options: {
                filename: "example_signature_request.pdf",
                contentType: "application/pdf",
            },
        };

        const firstBox = estimateBox(signer1, this.extractor);
        const secondBox = estimateBox(signer2, this.extractor);

        const result = await this.api.signatureRequestSend({
            title,
            subject,
            message,
            signers: [signer1, signer2],
            files: [file],
            signingOptions,
            testMode: import.meta.env.DROPBOX_TEST_MODE === "true",
            formFieldsPerDocument: [
                {
                    apiId: "signature_field_1",
                    signer: 0,
                    type: "signature",
                    ...firstBox,
                    page: this.extractor.numPages,
                    documentIndex: 0,
                    required: false,
                },
                {
                    apiId: "signature_field_2",
                    signer: 1,
                    type: "signature",
                    ...secondBox,
                    page: this.extractor.numPages,
                    documentIndex: 0,
                    required: false,
                },
            ],
        });

        const signUrl = result.body.signatureRequest.signingUrl;
        return signUrl;
    }
}
