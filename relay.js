const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let phoneClient = null;
let pcClient = null;

console.log(`Relay server starting on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');

    // Пинг каждые 30 секунд чтобы соединение не обрывалось
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);

    ws.on('pong', () => {
        // Соединение живое
    });

    ws.on('message', (data, isBinary) => {
        if (!isBinary) {
            const text = data.toString();

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

            // Команды от ПК → телефон
            if (ws === pcClient && phoneClient && phoneClient.readyState === WebSocket.OPEN) {
                phoneClient.send(text);
            }

            // Текст от телефона → ПК (resolution, location)
            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(text);
            }

        } else {
            // Бинарные данные (кадры экрана/камеры) от телефона → ПК
            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(data, { binary: true });
            }
        }
    });

    ws.on('close', () => {
        clearInterval(pingInterval);
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
        clearInterval(pingInterval);
        console.error('WS error:', err.message);
    });
});

console.log(`Relay server running on port ${PORT}`);
