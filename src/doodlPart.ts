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

export type DoodlPart = {
    on(event: keyof PartEvents, listener: Handler<any>): void;
    off(event: keyof PartEvents, listener: Handler<any>): void;
    start(): void;
    stop(): void;
};

type PartEvents = {
    start: void;
    done: void;
    retry: void;
    data: number;
    error: string;
};

let _downloadedBytes: number = 0;
let _fileSize: number = 0;

let _writeStream: fs.WriteStream;
let _options: PartOptions;
let _requestStream: Neofetch;

const _successCodes: number[] = [200, 206];
const _emitter: Emitter<PartEvents> = mitt<PartEvents>();

export function doodlPart(options: PartOptions): DoodlPart {
    _options = options;

    return {
        start,
        stop,
        on,
        off,
    };
}

function start(): void {
    const Range: string = getRange();

    if (Range !== null) {
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
        _writeStream.on('error', onError);
    } else {
        setImmediate(() => _emitter.emit('done'));
    }
}

function stop(): void {
    _requestStream.abort();
}

function onResponse(res: Response): void {
    res.body.on('error', onError);
    res.body.on('end', onStreamEnd);

    if (_successCodes.includes(res.status)) {
        res.body.on('data', onStreamData);
        res.body.pipe(_writeStream);
    }

    if (res.status > 500) setImmediate(() => _emitter.emit('retry'));
}

function onStreamEnd(): void {
    const { start, end } = _options.range;
    const totalSize = end - start + 1;
    const size = _fileSize + _downloadedBytes;

    if (totalSize === size) setImmediate(() => _emitter.emit('done'));
}

function onStreamData(data: Buffer): void {
    _downloadedBytes += data.length;
    setImmediate(() => _emitter.emit('data', _downloadedBytes + _fileSize));
}

function onError(err: Error): void {
    if (err.name !== 'AbortError') _emitter.emit('error', err.name);
    setImmediate(() => _writeStream.close());
}

function getRange(): string {
    let { start, end } = _options.range;
    let range: PartRange;

    if (fs.existsSync(_options.path)) {
        _fileSize = fs.statSync(_options.path).size;

        range = {
            start: start + _fileSize,
            end,
        };
    } else {
        range = _options.range;
    }

    return verifyRange(range);
}

function verifyRange(range: PartRange): string {
    const size = range.end - range.start + 1;

    if (size < 0) {
        fs.truncateSync(_options.path);
        return getRangeString(_options.range);
    } else if (size === 0) {
        return null;
    } else {
        return getRangeString(range);
    }
}

function getRangeString(range: PartRange): string {
    return `bytes=${range.start}-${range.end}`;
}

function on(event: keyof PartEvents, listener: Handler<any>): void {
    _emitter.on(event, listener);
}

function off(event: keyof PartEvents, handler: Handler<any>): void {
    _emitter.off(event, handler);
}
