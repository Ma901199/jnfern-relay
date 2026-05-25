const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let phoneClient = null;
let pcClient = null;

console.log(`Relay server starting on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('New connection');

    ws.on('message', (data) => {
        // Текстовые сообщения — команды и идентификация
        if (typeof data === 'string' || data instanceof Buffer && isText(data)) {
            const text = data.toString();

            // Клиент представляется кто он
            if (text === 'I_AM_PHONE') {
                phoneClient = ws;
                console.log('Phone connected');
                ws.send('PHONE_REGISTERED');
                if (pcClient) {
                    pcClient.send('PHONE_ONLINE');
                }
                return;
            }

            if (text === 'I_AM_PC') {
                pcClient = ws;
                console.log('PC connected');
                ws.send('PC_REGISTERED');
                if (phoneClient) {
                    ws.send('PHONE_ONLINE');
                }
                return;
            }

            // Команды от ПК → на телефон (tap, swipe, resolution)
            if (ws === pcClient && phoneClient && phoneClient.readyState === WebSocket.OPEN) {
                phoneClient.send(text);
            }

            // Текст от телефона → на ПК (resolution)
            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(text);
            }

        } else {
            // Бинарные данные (кадры экрана) от телефона → на ПК
            if (ws === phoneClient && pcClient && pcClient.readyState === WebSocket.OPEN) {
                pcClient.send(data);
            }
        }
    });

    ws.on('close', () => {
        if (ws === phoneClient) {
            console.log('Phone disconnected');
            phoneClient = null;
            if (pcClient) pcClient.send('PHONE_OFFLINE');
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

function isText(buffer) {
    for (let i = 0; i < Math.min(buffer.length, 100); i++) {
        if (buffer[i] > 127) return false;
    }
    return true;
}

console.log(`Relay server running on port ${PORT}`);
