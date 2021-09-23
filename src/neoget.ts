import fs from 'fs/promises';
import path from 'path';
import mitt, { Emitter, Handler } from 'mitt';
import throttle from 'throttleit';

import { getPart, GetPart, PartEntry, PartOptions, PartRange } from './getPart';
import { getFilename, getMeta, Metadata } from './getMeta';
import { validate, Validation } from './util/validation';
import { getPartRanges } from './util/partRanges';
import { getAvgSpeed } from './util/averageSpeed';
import { deleteFiles, mergeFiles } from './util/mergeFiles';

export type Status =
    | 'REMOVED'
    | 'PAUSED'
    | 'WAITING'
    | 'ACTIVE'
    | 'BUILDING'
    | 'DONE'
    | 'ERROR';

export type Options = {
    url: string;
    dir: string;
    key?: string;
    threads?: number;
    filename?: string;
    headers?: object;
    throttleRate?: number;
};

export type Info = {
    size: number;
    downloaded: number;
    progress: number;
    speed: number;
    threads: number;
    partSizes: Array<number>;
    parts: Array<PartEntry>;
};

export type Data = {
    status: Status;
    options: Options;
    info: Info;
};

export type Neoget = {
    start(): void;
    pause(): void;
    remove(): void;
    on(event: keyof Events, listener: Handler<any>): void;
    off(event: keyof Events, listener: Handler<any>): void;
};

type Events = {
    start: Data;
    data: Data;
    error: string;
    done: void;
};

export async function neoget(options: Options): Promise<Neoget> {
    const SINGLE_CONNECTION: number = 1;
    const THROTTLE_RATE: number = 100;

    options.throttleRate ??= THROTTLE_RATE;
    options.threads ??= 1;
    options.filename ??= getFilename(options.url);

    let _filepath: string;
    let _metafile: string;

    let _doneArray: Array<number> = [];
    let _removedArray: Array<number> = [];
    let _errorArray: Array<number> = [];
    let _retryQueue: Array<number> = [];

    const updateT: Function = throttle(update, THROTTLE_RATE);
    const isValid: Validation = validate(options);
    const _emitter: Emitter<Events> = mitt<Events>();

    let _meta: Metadata;
    let _info: Info;
    let _status: Status;
    let _parts: Array<GetPart> = [];

    if (isValid.ok) {
        _meta = await getMeta(options.url);
        _filepath = path.join(options.dir, options.filename);
        _metafile = _filepath + '.json';

        if (!_meta.acceptRanges) options.threads = SINGLE_CONNECTION;

        try {
            options = JSON.parse(
                await fs.readFile(_metafile, { encoding: 'utf8' })
            );
        } catch (_) {
            await fs.writeFile(_metafile, JSON.stringify(options), {
                encoding: 'utf8',
            });
        }

        setDefaults();
    } else {
        setImmediate(() => _emitter.emit('error', isValid.err));
    }

    function mapParts(val: PartEntry, index: number) {
        const partOptions: PartOptions = {
            url: options.url,
            path: val.path,
            range: val.range,
            headers: options.headers,
        };
        const part = getPart(partOptions);

        part.on('data', onData(index));
        part.on('done', onDone(index));
        part.on('retry', onRetry(index));
        part.on('error', onError(index));
        part.on('removed', onRemoved(index));
        part.start();

        return part;
    }

    function start(): void {
        if (_parts.length === 0) {
            _doneArray = [];
            _status = 'ACTIVE';
            setImmediate(() => {
                _emitter.emit('start', {
                    status: _status,
                    options: options,
                    info: _info,
                });
            });
            _parts = _info.parts.map(mapParts);
        } else {
            _parts.forEach((part) => part.start());
        }
    }

    function pause(): void {
        _parts.forEach((part: GetPart) => part.stop());
        setStatus('PAUSED');
    }

    function remove(): void {
        _removedArray = [];
        _parts.forEach((part: GetPart) => part.remove());
    }

    function onData(index: number) {
        return function curry(size: number): void {
            _info.partSizes[index] = size;
            updateT();
        };
    }

    function onDone(index: number) {
        return async function curry(size: number): Promise<void> {
            _info.partSizes[index] = size;

            if (!_doneArray.includes(index)) _doneArray.push(index);
            if (_retryQueue.length > 0) _parts[_retryQueue.shift()].start();
            if (_doneArray.length === options.threads) {
                const files: Array<string> = _info.parts.map(
                    (part: PartEntry) => part.path
                );
                _info.speed = 0;
                setStatus('BUILDING');
                if (await mergeFiles(files, _filepath)) {
                    files.push(_metafile);
                    await deleteFiles(files);
                    setStatus('DONE');
                    setImmediate(() => _emitter.emit('done'));
                } else {
                    setStatus('ERROR');
                    setImmediate(() => _emitter.emit('error', 'MergeError'));
                }
            }
        };
    }

    function onRetry(index: number) {
        return function curry(): void {
            if (!_retryQueue.includes(index)) _retryQueue.push(index);
            if (_retryQueue.length === options.threads) {
                setStatus('ERROR');
                setImmediate(() => _emitter.emit('error', 'FetchError'));
            }
        };
    }

    function onError(index: number) {
        return function curry(name: string): void {
            if (!_errorArray.includes(index)) _errorArray.push(index);
            if (_errorArray.length === options.threads) {
                _emitter.emit('error', name);
                setStatus('ERROR');
            }
        };
    }

    function onRemoved(index: number) {
        return function curry(): void {
            if (!_removedArray.includes(index)) _removedArray.push(index);
            if (_removedArray.length === options.threads) {
                setStatus('REMOVED');
            }
        };
    }

    function setDefaults() {
        _status = 'WAITING';
        _info = {
            size: _meta.contentLength,
            progress: 0,
            speed: 0,
            threads: options.threads,
            downloaded: 0,
            partSizes: Array(options.threads).fill(0),
            parts: getPartRanges(_meta.contentLength, options.threads).map(
                mapPartData
            ),
        };

        emitData();
    }

    function mapPartData(range: PartRange, index: number): PartEntry {
        return {
            range,
            path: _filepath + '.' + index,
        };
    }

    function emitData(): void {
        setImmediate(() =>
            _emitter.emit('data', {
                status: _status,
                options: options,
                info: _info,
            })
        );
    }

    function update(): void {
        _info.downloaded = _info.partSizes.reduce(
            (sum: number, current: number) => sum + current
        );
        _info.speed = getAvgSpeed(_info.downloaded);
        _info.progress = (_info.downloaded / _info.size) * 100;
        emitData();
    }

    function setStatus(status: Status) {
        _status = status;
        update();
    }

    function on(event: keyof Events, listener: Handler<any>): void {
        _emitter.on(event, listener);
    }

    function off(event: keyof Events, handler: Handler<any>): void {
        _emitter.off(event, handler);
    }

    return {
        start,
        pause,
        remove,
        on,
        off,
    };
}
