import fs from 'fs';
import validFilename from 'valid-filename';

import { Options } from '../doodlMain';

export function validateInputs(options: Options): void {
    const { threads, throttleRate } = options;

    if (!isURL(options.url)) throw 'Invalid URL';
    if (threads <= 0 || threads > 16) throw 'Invalid number of threads';
    if (throttleRate < 100 || throttleRate > 2000) throw 'Invalid throttle tate';
    if (!isDir(options.dir)) throw 'Invalid directory path';
    if (!validFilename(options.fileName)) throw 'Invalid file name';
}

function isDir(directory: string): boolean {
    try {
        const stat: fs.Stats = fs.lstatSync(directory);
        return stat.isDirectory();
    } catch (err) {
        return false;
    }
}

function isURL(location: string) {
    try {
        const url = new URL(location);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}
