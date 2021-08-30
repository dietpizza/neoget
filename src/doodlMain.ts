import fs from 'fs/promises';
import path from 'path';
import mitt, { Emitter } from 'mitt';
import throttle from 'throttleit';

import { doodlPart, DoodlPart, PartOptions, PartRange } from './doodlPart';
import { doodlQuery, Metadata } from './doodlQuery';
import { validateInputs } from './util/validation';
import { getPartRanges } from './util/partRanges';
import { getAvgSpeed } from './util/averageSpeed';

export type Status = 'REMOVED' | 'PAUSED' | 'WAITING' | 'ACTIVE' | 'BUILDING' | 'DONE';

export type Options = {
    url: string;
    dir: string;
    key?: string;
    threads?: number;
    fileName?: string;
    headers?: object;
    throttleRate?: number;
};

export type Info = {
    size: number;
    progress: number;
    speed: number;
    threads: number;
    downloaded: number;
    tPositions: Array<number>;
    parts: Array<Part>;
};

export type Data = {
    status: Status;
    options: Options;
    info: Info;
};

export type Doodl = {
    start(): void;
};

type DoodleEvents = {
    start: Data;
    data: Data;
    error: string;
    done: void;
};

type Part = {
    range: PartRange;
    path: string;
};

let _options: Options;
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

const update_t = throttle(update, THROTTLE_RATE);
const _emitter: Emitter<DoodleEvents> = mitt<DoodleEvents>();

export async function doodl(options: Options): Promise<Doodl> {
    try {
        validateInputs(options);
        _filepath = path.join(_options.dir, _options.fileName);
        _metafile = _filepath + '.json';

        _meta = await doodlQuery(options.url);

        if (!_meta.acceptRanges) options.threads = SINGLE_CONNECTION;
        try {
            _options = JSON.parse(await fs.readFile(_metafile, { encoding: 'utf8' }));
        } catch (_) {
            _options = options;
            _options.throttleRate ??= THROTTLE_RATE;
        }

        setDefaults();
    } catch (err) {
        setImmediate(() => _emitter.emit('error', `OptionsError: ${err.message}`));
    }

    return {
        start,
    };
}

function setDefaults() {
    _status = 'WAITING';
    _info = {
        size: _meta.contentLength,
        progress: 0,
        speed: 0,
        threads: _options.threads,
        downloaded: 0,
        tPositions: Array(_options.threads).fill(0),
        parts: getPartRanges(_meta.contentLength, _options.threads).map(
            (range: PartRange, index: number) => {
                return {
                    range,
                    path: _filepath + '.' + index,
                };
            }
        ),
    };

    emitData();
}

function emitData() {
    setImmediate(() =>
        _emitter.emit('data', {
            status: _status,
            options: _options,
            info: _info,
        })
    );
}

function start(): void {
    _doneCount = 0;
    _status = 'ACTIVE';

    _parts = _info.parts.map(({ range, path }) => {
        const partOptions: PartOptions = {
            url: _options.url,
            path,
            range,
            headers: _options.headers,
        };
        const dPart = doodlPart(partOptions);
        dPart.start();
        dPart.on('data', update_t);
        return dPart;
    });
}

function update(): void {
    _info.downloaded = _info.tPositions.reduce((sum: number, current: number) => sum + current);
    _info.speed = getAvgSpeed(_info.downloaded);
    _info.progress = (_info.downloaded / _info.size) * 100;
}
