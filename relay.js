const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let phoneClient = null;
let pcClient = null;

console.log(`Relay server starting on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (data, isBinary) => {
        if (!isBinary) {
            const text = data.toString();

            if (text === 'PING') {
                ws.send('PONG');
                return;
            }

            if (text === 'I_AM_PHONE') {
                phoneClient = ws;
                console.log('Phone connected');
                ws.send('PHONE_REGISTERED');
                if (pcClient && pcClient.readyState === WebSocket.OPEN) {
                    pcClient.send('PHONE_ONLINE');
                    ws.send('PC_ONLINE');
                }
                return;
            }

            if (text === 'I_AM_PC') {
                pcClient = ws;
                console.log('PC connected');
                ws.send('PC_REGISTERED');
                if (phoneClient && phoneClient.readyState === WebSocket.OPEN) {
                    ws.send('PHONE_ONLINE');
                    phoneClient.send('PC_ONLINE');
                }
                return;
            }

            if (ws === pcClient && phoneClient && phoneClient.readyState === WebSocket.OPEN) {
                phoneClient.send(text);
            }

            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(text);
            }

        } else {
            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(data, { binary: true });
            }
        }
    });

    ws.on('close', () => {
        if (ws === phoneClient) {
            console.log('Phone disconnected');
            phoneClient = null;
            if (pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send('PHONE_OFFLINE');
            }
        }
        if (ws === pcClient) {
            console.log('PC disconnected');
            pcClient = null;
        }
    });

    ws.on('error', (err) => {
        console.error('WS error:', err.message);
    });
});

// Пинг каждые 20 секунд — держит соединения живыми
const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('Terminating dead connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 20000);

wss.on('close', () => {
    clearInterval(pingInterval);
});

console.log(`Relay server running on port ${PORT}`);
