import fs from 'fs/promises';

export async function create<Type>(path?: string, delay?: number): Promise<Map<string, Type>> {
    let db: Map<string, Type> = new Map();

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
        await writeToDisk();
    }

    setInterval(writeToDisk, delay).unref();
    process.on('beforeExit', cleanup);

    return db;
}
