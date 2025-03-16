export function link(name: string, url: string) {
    return `<a href="${url}">${name}</a>`;
}

export function quote(text: string, expandable = true) {
    return `<blockquote${expandable ? " expandable" : ""}>${text}</blockquote>`;
}

export function italic(text: string) {
    return `<i>${text}</i>`;
}
