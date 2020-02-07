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
        // ws.binaryType = "nodebuffer"; // default
        ws.binaryType = "arraybuffer";
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
                // console.log('ArrayBuffer:');
                // console.log(message);
                let interleaved = new Float32Array(message); // ArrayBuffer -> Float32Array
                let pcm = encodePCM(interleaved); // DataView.buffer == ArrayBuffer
                readable.push(Buffer.from(pcm.buffer)); // ArrayBuffer -> Buffer
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
            // if (ws.interval) clearInterval(ws.interval);
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

function encodePCM(samples) {
    let buffer = new ArrayBuffer(samples.length * 2);
    let view = new DataView(buffer);
    floatTo16BitPCM(view, 0, samples);
    return view;
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}