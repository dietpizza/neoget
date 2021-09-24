import { nanoid } from "nanoid";

import { create } from "./util/database";
import { Options, Data, Neoget, neoget } from "./neoget";

export type Queue = {
  add(options: Options): void;
  pause(key: string): void;
  getData(): Array<Data>;
  startQueue(): void;
  stopQueue(): void;
};

export async function queue(): Promise<Queue> {
  const db = await create<Data>("/home/rohan/neoget.db");
  const clients = new Map<string, Neoget>();
  let isActive: boolean = false;

  async function add(options: Options): Promise<void> {
    const key = nanoid();
    const client = await neoget(options);

    client.on("start", (data: Data) => {
      db.set(key, data);
    });
    client.on("data", (data: Data) => {
      db.set(key, data);
    });
    client.on("error", (err: string) => {
      switch (err) {
      }
    });
    client.on("done", () => {
      clients.delete(key);
    });
    client.start();

    clients.set(key, client);
  }

  async function pause(key: string) {
    const client = clients.get(key);
    client.pause();
  }
  function getData(): Array<Data> {
    return [...db.values()];
  }

  function startQueue(): void {
    isActive = true;
  }

  function stopQueue(): void {
    isActive = false;
  }

  return {
    add,
    pause,
    getData,
    startQueue,
    stopQueue,
  };
}
