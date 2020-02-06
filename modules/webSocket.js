const fs = require('fs');
const WebSocket = require("ws");
const {
    Readable
} = require('stream');

const {
    stt_kakao,
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

        // let streamData = [];
        let readable;
        ws.binaryType = "nodebuffer"; // default
        // ws.binaryType = "arraybuffer";
        // ws.binaryType = "fragments";

        ws.on('message', (message) => {
            if (typeof message == 'string') {
                try {
                    let msg = JSON.parse(message);
                    switch (msg.cmd) {
                        case "recog":
                            // streamData = [];
                            readable = new Readable();
                            readable._read = () => {};
                            stt_kakao(readable, function (data) {
                                if (data.data.type == "finalResult" || data.data.type == "partialResult" || data.data.type == "errorCalled") {
                                    let result = {
                                        cmd: data.data.type,
                                        msg: data.data.value
                                    };
                                    ws.send(JSON.stringify(result));
                                }
                            });
                            break;
                        case "recogEnd":
                            // method 1 stream -> buffer
                            // let buffer = Buffer.concat(streamData);
                            // console.log('buffer', buffer);
                            // stt_kakao(buffer);

                            // method 2 stream -> readable stream
                            readable.push(null); // end of stream
                            break;
                    }
                    console.log(msg);
                } catch (err) {
                    console.error(err);
                }
                console.log("string:", message);
                ws.send('msg from server');
            } else if (message instanceof Buffer) {
                // console.log('Buffer:');
                // console.log(message);

                // streamData.push(message); // method 1
                readable.push(message); // method 2
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

    // test for kakao
    // let readStream = fs.createReadStream('media/heykakao.wav');
    // stt_kakao(readStream, function (data) {
    //     console.log(data);
    // });
}
