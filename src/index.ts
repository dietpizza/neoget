import express, { Application, Request, Response } from 'express';
import enableWs, { Instance } from 'express-ws';
import Websocket from 'ws';

import { encode, decode } from './util/jsonhelper';

const PORT: number = 3000;

const appBase: Application = express();
const wsInstance: Instance = enableWs(appBase);
// const wss: Server = wsInstance.getWss();

let { app } = wsInstance;

app.use(express.json());

app.ws('/data', (ws: Websocket) => {
    ws.on('message', () => {});
    ws.send(
        encode({
            connect: 'ok',
        })
    );
});

app.listen(PORT, () => {
    console.log('Server is up and running on port', PORT);
});
