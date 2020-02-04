let webSock;

onmessage = (evt) => {
    let ed = evt.data;
    if (ed.command != 'record') {
        console.log('onmessage in worker:', ed.command);
    }
    switch (ed.command) {
        case 'init':
            init();
            break;
        case 'clear':
            clear();
            break;
        case 'startRecord':
            startRecord();
            break;
        case 'stopRecord':
            stopRecord();
            break;
        case 'close':
            WebClose();
            break;
        case 'record':
            record(ed.buffer);
            break;
    }
}

function init() {
    WebConnection();
    WebConfig();
}

function WebConnection() {
    webSock = new WebSocket("wss://speech-api.kakao.com:9443/stt");
}

function WebConfig() {
    webSock.onopen = function () {
        console.log("websock onopen");
        postMessage({
            aType: 'text',
            aBuf: '{\"cmd\":\"onopen\"}'
        });
    };

    webSock.onmessage = function (evt) {
        console.log("websock onmessage");
        if (evt.data instanceof Blob) {
            postMessage({
                aType: 'blob',
                aBuf: new Blob(evt.data)
            });
        } else if (evt.data instanceof ArrayBuffer) {
            postMessage({
                aType: 'blob',
                aBuf: new Blob([evt.data], {
                    type: "audio/wav"
                })
            });
        } else {
            postMessage({
                aType: 'text',
                aBuf: evt.data
            });
        }
        console.log(evt.data);
    };

    webSock.onclose = function () {
        console.log("websock onclose");
    };

    webSock.onerror = function (err) {
        console.log("websock onerror", err);
    };
}

let recLength = 0;
let recBuffersL = [];
let recBuffersR = [];

function clear() {
    recLength = 0;
    recBuffersL = [];
    recBuffersR = [];
}

function startRecord() {
    console.log('startRecord');
    if (webSock != 0 && webSock.readyState == 1) {
        let cmdJ = new Object();
        cmdJ.cmd = 'recog';
        cmdJ.aiid = 'aiid';
        cmdJ.kaccountid = 'kaccountid';
        cmdJ.service = 'DICTATION';
        webSock.send(JSON.stringify(cmdJ));
    }
}

function stopRecord() {
    console.log('stopRecord');
    if (webSock != 0 && webSock.readyState == 1) {
        let cmdJ = new Object();
        cmdJ.cmd = 'recogEnd';
        cmdJ.aiid = 'aiid';
        cmdJ.kaccountid = 'kaccountid';
        cmdJ.service = 'DICTATION';
        webSock.send(JSON.stringify(cmdJ));
    }
}

function WebClose() {
    webSock.close();
}

function record(inputBuffer) {
    recBuffersL.push(inputBuffer[0]);
    recBuffersR.push(inputBuffer[1]);
    recLength += inputBuffer[0].length;
    console.log('record:', recLength);
    if (webSock != 0 && webSock.readyState == 1) {
        webSock.binaryType = "arraybuffer";
        let interleaved = resample(inputBuffer[0]);
        let pcm = encodePCM(interleaved);
        webSock.send(pcm);
    }
}

// shorten buffer length with value
let outputSampleRate = 16000;
let sampleRate = 48000;

function resample(e) {
    let t = e.length;
    let s = 0,
        o = sampleRate / outputSampleRate, // 48000 / 16000 = 3
        u = Math.ceil(t * outputSampleRate / sampleRate),
        a = new Float32Array(u);
    for (i = 0; i < u; i++) {
        a[i] = e[Math.floor(s)];
        s += o;
    }
    return a;
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