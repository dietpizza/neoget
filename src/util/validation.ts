import fs from "fs";

import { Options } from "../neoget";

export type Validation = {
  ok: boolean;
  err: string;
};

export function validate(options: Options): Validation {
  const { threads, throttleRate }: Options = options;

  let ret: Validation = {
    ok: false,
    err: null,
  };

  if (!isURL(options.url)) ret.err = "Invalid URL";
  if (threads <= 0 || threads > 16) ret.err = "Invalid number of threads";
  if (throttleRate < 100 || throttleRate > 2000)
    ret.err = "Invalid throttle tate";
  if (!isDir(options.dir)) ret.err = "Invalid directory path";

  ret.ok = true;
  return ret;
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
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}
