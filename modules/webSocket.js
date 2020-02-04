const fs = require('fs');
const WebSocket = require("ws");
const {
    stt1_kakao,
    stt2_kakao
} = require('./kakao-api');

module.exports = (server) => {
    const wss = new WebSocket.Server({
        server
    });

    // WebSocketServer
    // console.log(Object.getPrototypeOf(wss).constructor.name);

    wss.on('connection', (ws, req) => {
        console.log('wss.on connection');
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        console.log('ip:', ip);

        let streamData = [];
        ws.binaryType = "nodebuffer"; // default
        // ws.binaryType = "arraybuffer";
        // ws.binaryType = "fragments";

        ws.on('message', (message) => {
            if (typeof message == 'string') {
                try {
                    let msg = JSON.parse(message);
                    switch (msg.cmd) {
                        case "recogStart":
                            streamData = [];
                            break;
                        case "recogEnd":
                            // test for kakao
                            // let readStream = fs.createReadStream('media/heykakao.wav');
                            // stt1_kakao(readStream, function (data) {
                            //     console.log(data);
                            // });

                            let buffer = Buffer.concat(streamData);
                            console.log(buffer);
                            stt2_kakao(buffer, function (data) {
                                console.log(data);
                            });
                            break;
                    }
                    console.log(msg);
                } catch (err) {
                    console.error(err);
                }
                console.log("string:", message);
                ws.send('msg from server');
            } else if (message instanceof Buffer) {
                console.log('Buffer:');
                console.log(message);
                // console.log(message.toString());
                // ws.send(message);

                streamData.push(message);
            } else if (message instanceof ArrayBuffer) {
                console.log('ArrayBuffer:');
                console.log(message);
                ws.send(message);
            } else if (message instanceof Array) {
                console.log('Array:');
                console.log(message);
            } else {
                console.log('Others:', Object.getPrototypeOf(message).constructor.name);
            }
        });

        ws.on('error', (error) => {
            console.log(error);
        });

        ws.on('close', () => {
            console.log('ws.on close');
            if (ws.interval) clearInterval(ws.interval);
        });

        // const interval = setInterval(() => {
        //     if (ws.readyState == ws.OPEN) {
        //         console.log(cnt, 'send msg to client');
        //         ws.send([cnt++, 'message from server']);
        //     }
        // }, 10000);
        // ws.interval = interval;
    });
}
