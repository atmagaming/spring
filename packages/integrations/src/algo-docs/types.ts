export interface ExtractedData {
    id: string;
    documentId: number;
    uploadedAt: string;
    processedAt: string;
    fileName: string;
    folderId: string;
    mediaOriginal: string;
    mediaExcel: string;
    mediaJson: string;
    mediaXml: string;
    totalPages: number;
    pageNumber: number;
    data: Record<string, string>;
}

export interface UploadDocumentResponse {
    id: number;
    fileSize: number;
    fileMD5CheckSum: string;
    uploadedAt: string;
}

export interface Folder {
    id: string;
    parentId: string | null;
    name: string;
}

export interface Extractor {
    id: string;
    name: string;
}
