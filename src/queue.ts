import { nanoid } from 'nanoid';

import { create } from './util/database';
import { Options, Data, Neoget, neoget } from './neoget';

export type Queue = {
    add(options: Options): void;
    pause(key: string): void;
    getData(): void;
};

export async function queue(): Promise<Queue> {
    const db = await create<Data>('/home/rohan/neoget.db');
    const clients = new Map<string, Neoget>();

    async function add(options: Options) {
        const key = nanoid();
        const client = await neoget(options);

        client.on('start', (data: Data) => {
            db.set(key, data);
        });
        client.on('data', (data: Data) => {
            db.set(key, data);
        });
        client.on('error', (err: string) => {
            switch (err) {
            }
        });
        client.on('done', () => {
            clients.delete(key);
        });
        client.start();

        clients.set(key, client);
    }

    async function pause(key: string) {
        const client = clients.get(key);
        client.pause();
    }

    function getData() {
        return Object.fromEntries(db);
    }

    return {
        add,
        pause,
        getData,
    };
}
