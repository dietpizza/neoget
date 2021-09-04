import fs from 'fs/promises';

export type dB = Map<string, object>;

export async function create(path?: string, delay?: number): Promise<dB> {
    let db: dB = new Map();

    async function cleanup() {
        await writeToDisk();
        process.exit(0);
    }

    async function writeToDisk() {
        const json = Object.fromEntries(db);
        try {
            await fs.writeFile(path, JSON.stringify(json), { encoding: 'utf8' });
        } catch (err) {
            console.log(err);
        }
    }

    if (delay < 1000 || delay > 2000) delay = 1000;

    try {
        const data = await fs.readFile(path, { encoding: 'utf8' });
        db = new Map(Object.entries(JSON.parse(data)));
    } catch (err) {
        const data = JSON.stringify(db);
        await writeToDisk();
    }

    setInterval(writeToDisk, delay).unref();
    process.on('beforeExit', cleanup);

    return db;
}
