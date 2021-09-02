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
    on(event: keyof Events, listener: Handler<any>): void;
    off(event: keyof Events, listener: Handler<any>): void;
    start(): void;
    stop(): void;
    remove(): void;
};

export type Part = {
    range: PartRange;
    path: string;
};

type Events = {
    retry: void;
    removed: void;
    data: number;
    done: number;
    error: string;
};

export function doodlPart(options: PartOptions): DoodlPart {
    let _downloadedBytes: number = 0;
    let _fileSize: number = 0;

    let _writeStream: fs.WriteStream;
    let _options: PartOptions;
    let _request: Neofetch;

    const _emitter: Emitter<Events> = mitt<Events>();

    _options = options;

    function start(): void {
        const Range: string = getRange();

        if (Range !== null) {
            _writeStream = fs.createWriteStream(_options.path, {
                flags: 'a+',
            });
            _writeStream.on('error', onError);

            _request = neofetch(_options.url, {
                headers: {
                    ..._options.headers,
                    Range,
                },
            });
            _request.ready.then(onResponse).catch(onError);
        } else {
            setImmediate(() => _emitter.emit('done', _fileSize));
        }
    }

    function stop(): void {
        _request.abort();
    }

    function remove(): void {
        stop();
        fs.unlinkSync(_options.path);
        setImmediate(() => _emitter.emit('removed'));
    }

    function onResponse(res: Response): void {
        res.body.on('error', onError);
        res.body.on('end', onStreamEnd);
        if (res.ok) {
            res.body.on('data', onStreamData);
            res.body.pipe(_writeStream, { end: true });
        }

        switch (res.status) {
            case 503:
                setImmediate(() => _emitter.emit('retry'));
                break;
            case 511:
                setImmediate(() => _emitter.emit('error', 'AuthError'));
                break;
        }
    }

    function onStreamEnd(): void {
        const { start, end } = _options.range;
        const totalSize = end - start + 1;
        const size = _fileSize + _downloadedBytes;

        if (totalSize === size) setImmediate(() => _emitter.emit('done', size));
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

    function on(event: keyof Events, listener: Handler<any>): void {
        _emitter.on(event, listener);
    }

    function off(event: keyof Events, handler: Handler<any>): void {
        _emitter.off(event, handler);
    }

    return {
        start,
        stop,
        remove,
        on,
        off,
    };
}
