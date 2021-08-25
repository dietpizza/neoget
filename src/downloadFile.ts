import { PartRange } from './downloadPart';

export interface Options {
    url: string;
    key?: string;
    threads?: number;
    dir: string;
    fileName?: string;
    headers?: object;
    throttleRate?: number;
}

export interface Meta {
    size: number;
    progress: number;
    speed: number;
    threads: number;
    downloaded: number;
    tPositions: number[];
    partRanges: PartRange[];
    partFiles: string[];
}
