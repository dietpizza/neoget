export function decode(str: string) {
    return JSON.parse(str);
}

export function encode(json: object) {
    return JSON.stringify(json);
}
