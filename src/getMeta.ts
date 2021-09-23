import fetch, { Response } from 'node-fetch';
import { Neofetch, neofetch } from './util/neofetch';

export type Metadata = {
    readonly acceptRanges: boolean;
    readonly contentLength: number;
};

const errorArray: Array<string> = ['ECONNRESET', 'ENOTFOUND'];
const TIMEOUT: number = 5000;

export async function getMeta(
    url: string,
    headers?: object
): Promise<Metadata> {
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            headers: { ...headers },
            timeout: TIMEOUT,
        });
        return {
            acceptRanges: res.headers.get('accept-ranges') === 'bytes',
            contentLength: parseInt(res.headers.get('content-length')),
        };
    } catch (err: any) {
        if (errorArray.includes(err.name)) {
            return {
                acceptRanges: false,
                contentLength: NaN,
            };
        } else {
            return await fakeHead(url, headers);
        }
    }
}

async function fakeHead(url: string, headers?: object): Promise<Metadata> {
    let metadata: Metadata;
    const request: Neofetch = neofetch(url, {
        headers: { ...headers, Range: 'bytes=0-99' },
        timeout: TIMEOUT,
    });

    try {
        const res: Response = await request.ready;
        res.body.on('data', (data: Buffer) => {
            if (data.length > 100) request.abort();
        });
        metadata = {
            acceptRanges: true,
            contentLength: parseInt(
                res.headers.get('content-range').split('/').pop()
            ),
        };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            metadata = {
                acceptRanges: false,
                contentLength: metadata.contentLength,
            };
        } else {
            metadata = {
                acceptRanges: false,
                contentLength: NaN,
            };
        }
    }
    return metadata;
}

export function getFilename(url: string): string {
    return url.split('/').pop().split('#').shift().split('?').shift();
}
