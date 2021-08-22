import mitt, { Emitter, EventType, Handler } from 'mitt';

export interface PartRange {
    readonly start: number;
    readonly end: number;
}

export interface PartOptions {
    url: string;
    path: string;
    range: PartRange;
    headers?: object;
}

type Events = {
    data: number;
    error: Error;
    start: void;
    complete: void;
};

type DownloadPart = {
    events: Emitter<Events>;
};

const _emitter: Emitter<Events> = mitt<Events>();

export function downloadPart(): DownloadPart {
    setInterval(() => _emitter.emit('data', 0xdeadbeef), 100);
    return {
        events: _emitter,
    };
}
