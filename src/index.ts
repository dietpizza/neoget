import * as https from "https";
import * as http from "http";
import express from "express";
import cors from "cors";

import { readFileSync } from "fs";
import { resolve } from "path";
import { Server, Socket } from "socket.io";

import { queue, Queue } from "./queue";

const PORT: number = 1337;
const serverOptions = {
  key: readFileSync(resolve(__dirname, "../ssl/LocalCert.key")),
  cert: readFileSync(resolve(__dirname, "../ssl/LocalCert.crt")),
};

const app = express();
const server = https.createServer(serverOptions, app);
const io = new Server(server, { cors: { origin: "*" } });
const sockets = io.sockets.sockets;

app.use(cors());
io.on("connection", onConnect);

server.listen(PORT, () => {
  console.log("Neoget is up and running on port", PORT);
  main().catch((err: Error) => {
    console.log(err.name);
  });
});

async function main(): Promise<void> {
  const cute: Queue = await queue();

  setInterval(() => {
    io.emit("data", cute.getData());
  }, 1000);
}

function onConnect(socket: Socket) {
  socket.on("data", onData);
  socket.on("disconnect", () => console.log("Disconnected!", sockets.size));
  console.log("Connection!", sockets.size);
}

function onData(data: object) {
  console.log(data);
}
