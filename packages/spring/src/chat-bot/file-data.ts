export interface IFileData {
    id: string;
    buffer: Buffer;
    name: string;
}

export interface ISendFileData {
    buffer: Buffer;
    fileName: string;
    caption?: string;
}
