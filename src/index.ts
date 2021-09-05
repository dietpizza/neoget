import http from 'http';
import { Server, Socket } from 'socket.io';

const PORT: number = 3000;

const server = http.createServer();
const io = new Server(server);

server.listen(PORT, () => {
    console.log('Server is up and running on port', PORT);
});

io.on('connection', onConnect);

function onConnect(socket: Socket) {
    socket.emit('data', {
        well: 'done',
    });

    socket.on('data', onData);
    console.log('New Connection!');
}

function onData(data: object) {
    console.log(data);
}
