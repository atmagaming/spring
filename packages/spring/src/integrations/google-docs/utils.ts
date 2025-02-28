export function getFileId(url: string) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match?.[1];
}
export function getDriveUrl(fileId: string) {
    return `https://drive.google.com/file/d/${fileId}`;
}
export function getDocsUrl(documentId: string) {
    return `https://docs.google.com/document/d/${documentId}`;
}
