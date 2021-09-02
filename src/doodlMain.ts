import fs from 'fs/promises';
import path from 'path';
import mitt, { Emitter, Handler } from 'mitt';
import throttle from 'throttleit';

import { doodlPart, DoodlPart, PartOptions, PartRange, Part } from './doodlPart';
import { doodlQuery, Metadata } from './doodlQuery';
import { validate, Validation } from './util/validation';
import { getPartRanges } from './util/partRanges';
import { getAvgSpeed } from './util/averageSpeed';
import { mergeFiles, deleteFiles } from './util/mergeFiles';

export type Status = 'REMOVED' | 'PAUSED' | 'WAITING' | 'ACTIVE' | 'BUILDING' | 'DONE' | 'ERROR';

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
    partsizes: Array<number>;
    parts: Array<Part>;
};

export type Data = {
    status: Status;
    options: Options;
    info: Info;
};

export type Doodl = {
    start(): void;
    on(event: keyof Events, listener: Handler<any>): void;
    off(event: keyof Events, listener: Handler<any>): void;
};

type Events = {
    start: Data;
    data: Data;
    error: string;
    done: void;
};

export async function doodl(options: Options): Promise<Doodl> {
    let _meta: Metadata;
    let _info: Info;
    let _status: Status;
    let _parts: Array<DoodlPart> = [];

    let _filepath: string;
    let _metafile: string;
    let _doneCount: number = 0;
    let _removedCount: number = 0;
    let _retryQueue: Array<number> = [];

    const SINGLE_CONNECTION: number = 1;
    const THROTTLE_RATE: number = 100;

    const update_t: Function = throttle(update, THROTTLE_RATE);
    const isValid: Validation = validate(options);
    const _emitter: Emitter<Events> = mitt<Events>();

    if (isValid.ok) {
        _filepath = path.join(options.dir, options.filename);
        _meta = await doodlQuery(options.url);
        _metafile = _filepath + '.json';

        if (!_meta.acceptRanges) options.threads = SINGLE_CONNECTION;

        try {
            options = JSON.parse(await fs.readFile(_metafile, { encoding: 'utf8' }));
        } catch (_) {
            options.throttleRate ??= THROTTLE_RATE;
        }

        setDefaults();
    } else {
        setImmediate(() => _emitter.emit('error', `OptionsError: ${isValid.err}`));
    }

    function start(): void {
        _doneCount = 0;
        setStatus('ACTIVE');
        if (_parts.length === 0) {
            _parts = _info.parts.map(mapParts);
        } else {
            _parts.forEach((part) => part.start());
        }
    }

    function pause(): void {
        _parts.forEach((part: DoodlPart) => part.stop());
        setStatus('PAUSED');
    }

    function remove(): void {
        _removedCount = 0;
        _parts.forEach((part: DoodlPart) => part.remove());
    }

    function onData(index: number) {
        return function (size: number) {
            _info.partsizes[index] = size;
            update_t();
        };
    }

    function onDone(index: number) {
        return async function curry(size: number) {
            _info.partsizes[index] = size;
            if (_retryQueue.length > 0) _parts[_retryQueue.shift()].start();
            if (++_doneCount === options.threads) {
                const files: Array<string> = _info.parts.map((part: Part) => part.path);
                setStatus('BUILDING');
                if (await mergeFiles(files, _filepath)) {
                    setStatus('DONE');
                    await deleteFiles(files);
                } else {
                    setStatus('ERROR');
                }
            }
        };
    }

    function onRetry(index: number) {
        return function curry() {
            if (!_retryQueue.includes(index)) _retryQueue.push(index);
        };
    }

    function onRemoved() {
        if (++_removedCount === options.threads) {
            setStatus('REMOVED');
        }
    }

    function setDefaults() {
        _status = 'WAITING';
        _info = {
            size: _meta.contentLength,
            progress: 0,
            speed: 0,
            threads: options.threads,
            downloaded: 0,
            partsizes: Array(options.threads).fill(0),
            parts: getPartRanges(_meta.contentLength, options.threads).map(mapPartData),
        };

        emitData();
    }

    function mapPartData(range: PartRange, index: number) {
        return {
            range,
            path: _filepath + '.' + index,
        };
    }

    function emitData() {
        setImmediate(() =>
            _emitter.emit('data', {
                status: _status,
                options: options,
                info: _info,
            })
        );
    }

    function mapParts(val: Part, index: number) {
        const partOptions: PartOptions = {
            url: options.url,
            path: val.path,
            range: val.range,
            headers: options.headers,
        };

        const part = doodlPart(partOptions);

        part.on('data', onData(index));
        part.on('done', onDone(index));
        part.on('retry', onRetry(index));

        part.start();

        return part;
    }

    function update(): void {
        _info.downloaded = _info.partsizes.reduce((sum: number, current: number) => sum + current);
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
        on,
        off,
    };
}
