import fetch, { Response } from "node-fetch";

export type Neofetch = {
  abort(): void;
  ready: Promise<Response>;
};

export function neofetch(url: string, options: object): Neofetch {
  const controller: AbortController = new AbortController();
  const { signal } = controller;

  return {
    abort: () => controller.abort(),
    ready: fetch(url, { ...options, signal }),
  };
}
