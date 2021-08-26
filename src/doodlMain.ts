import { PartRange } from './doodlPart';
import { doodlQuery, Metadata } from './doodlQuery';

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

export type Meta = {
    size: number;
    progress: number;
    speed: number;
    threads: number;
    downloaded: number;
    tPositions: number[];
    partRanges: PartRange[];
    partFiles: string[];
};

export type Info = {
    options: Options;
    meta: Meta;
    status: Status;
};

export function doodl(options: Options) {
    doodlQuery(options.url).then((meta: Metadata) => {
        console.log(meta);
    });
}
