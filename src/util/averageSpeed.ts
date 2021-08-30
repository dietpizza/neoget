const _samples: Array<number> = [];
const SAMPLE_SIZE: number = 8;

let _size: number = 0;
let _time: number = 0;

export function getAvgSpeed(size: number): number {
    const time: number = Date.now();
    const deltaT: number = _time > 0 ? (time - _time) / 1000 : 0;
    const deltaC: number = _size > 0 ? size - _size : 0;

    if (_samples.length > SAMPLE_SIZE) _samples.shift();

    _samples.push(correct(deltaC / deltaT));

    _time = time;
    _size = size;

    const speed: number = _samples.reduce((sum, val) => sum + val) / _samples.length;

    return Math.floor(speed);
}

function correct(speed: number) {
    if (isNaN(speed) || speed === Infinity || speed === undefined || speed < 0) {
        return 0;
    } else {
        return speed;
    }
}
