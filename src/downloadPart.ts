import fs from 'fs';
import mitt, { Emitter, Handler } from 'mitt';
import { Response } from 'node-fetch';

import { Neofetch, neofetch } from './util/neofetch';

export type PartRange = {
    readonly start: number;
    readonly end: number;
};

export type PartOptions = {
    url: string;
    path: string;
    range: PartRange;
    headers?: object;
};

export type DownloadPart = {
    on(event: keyof Events, listener: Handler<any>): void;
    off(event: keyof Events, listener: Handler<any>): void;
};

type Events = {
    start: void;
    done: void;
    error: string;
    retry: number;
    data: number;
};

let _downloadedBytes: number = 0;
let _fileSize: number = 0;

let _writeStream: fs.WriteStream;
let _options: PartOptions;
let _requestStream: Neofetch;

const _successCodes: number[] = [200, 206];
const _emitter: Emitter<Events> = mitt<Events>();

export function downloadPart(options: PartOptions): DownloadPart {
    _options = options;
    return {
        on,
        off,
    };
}

function start(): void {
    const range: PartRange = getRange();
    const Range: string = getRangeHeader(verifyRange(range) ? range : _options.range);

    _writeStream = fs.createWriteStream(_options.path, {
        flags: 'a+',
    });
    _requestStream = neofetch(_options.url, {
        headers: {
            ..._options.headers,
            Range,
        },
    });

    _requestStream.ready.then(onResponse).catch(onError);
}

function onResponse(res: Response): void {
    res.body.on('error', onError);
    res.body.on('end', onStreamEnd);

    if (_successCodes.includes(res.status)) {
        res.body.on('data', onStreamData);
        res.body.pipe(_writeStream);
    }
    if (res.status > 500) {
        setImmediate(() => _emitter.emit('retry', _fileSize));
    }
}

function onStreamEnd(): void {
    const { start, end } = _options.range;
    const totalSize = end - start + 1;
    const size = _fileSize + _downloadedBytes;

    setTimeout(() => {
        if (size === totalSize) _emitter.emit('done');
    }, 100);
    _downloadedBytes = 0;
}

function onStreamData(data: Buffer): void {
    _downloadedBytes += data.length;
    setImmediate(() => _emitter.emit('data', _downloadedBytes + _fileSize));
}

function onError(err: Error): void {
    if (err.name !== 'AbortError') _emitter.emit('error', err.name);
    _writeStream.close();
}

function getRange(): PartRange {
    let { start, end } = _options.range;
    if (fs.existsSync(_options.path)) {
        _fileSize = fs.statSync(_options.path).size;
        return {
            start: start + _fileSize,
            end,
        };
    } else {
        return {
            start,
            end,
        };
    }
}

function getRangeHeader(range: PartRange): string {
    return `bytes=${range.start}-${range.end}`;
}

function verifyRange(range: PartRange): boolean {
    if (range.start > range.end + 1) {
        fs.truncateSync(_options.path);
        return false;
    } else return true;
}

function on(event: keyof Events, listener: Handler<any>): void {
    _emitter.on(event, listener);
}

function off(event: keyof Events, handler: Handler<any>): void {
    _emitter.off(event, handler);
}
