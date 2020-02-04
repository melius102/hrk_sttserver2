// https://192.168.0.11:3000/

let dev_con = {
    mode: 1
};

switch (dev_con.mode) {
    case 0: // kakao_demo
        dev_con.wss = "wss://speech-api.kakao.com:9443/stt";
        break;
    case 1: // local or heroku
        // dev_con.wss = "wss://192.168.0.11:3000";
        dev_con.wss = "wss://melius-stts.herokuapp.com/";
        break;
}

let isInit = false;
let audioContext;
let audioRecorder;
let gainNode;

function initGUI(isInit) {
    if (isInit) {
        $('#btnPlay').text("Play");
        $('.hidden').slideDown();
    } else {
        $('#btnPlay').text("Initialization");
        $('.hidden').fadeOut();
    }
}

initGUI(isInit);


function resultMsg(msg) {
    $('#result').text(msg);
}

function initAudio() {
    if (isInit) return;
    resultMsg('Initializing audio ...');
    audioContext = new window.AudioContext();

    let constraints = {
        "audio": {
            "mandatory": {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            },
            "optional": []
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
            gainNode = audioContext.createGain();
            zeroNode = audioContext.createGain();
            zeroNode.gain.setValueAtTime(0.0, audioContext.currentTime);

            let audioInput = audioContext.createMediaStreamSource(stream);
            audioInput.connect(gainNode).connect(zeroNode);
            zeroNode.connect(audioContext.destination);
            // audioInput -> gainNode -> zeroNode -> destination

            audioRecorder = new Recorder(gainNode);
            audioRecorder.newWorker();
            if (dev_con.mode == 1) {
                audioRecorder.init(); // connect webSocket
            }
            isInit = true;
            initGUI(isInit);
            resultMsg('Initialization complete');
        })
        .catch((err) => {
            console.log("navigator.getUserMedia error: ", err);
        });
}

function audioRecorderStart() {
    console.log('audioRecorderStart ...');
    if (audioRecorder.connection) { // webSocket connection > recording
        resultMsg('Recording ...');
        audioRecorder.clear();
        audioRecorder.record();
    } else if (playState) {
        setTimeout(function () {
            audioRecorderStart();
        }, 1000);
    }
}

let playState = false;

function clickPlay() {
    initAudio();
    if (!isInit || playState) return;
    playState = true;
    console.log("*****Start*****");
    // gainNode.gain.value = 1.0;

    resultMsg('Connecting to server ...');
    if (dev_con.mode == 0) {
        audioRecorder.init(); // connect webSocket
    }
    audioRecorderStart();
    setTimeout(clickStop, 10000);
}

function clickStop() {
    if (!isInit || !playState) return;
    playState = false;
    console.log("*****Stop*****");
    // gainNode.gain.value = 0.0;

    audioRecorder.stop();
    if (dev_con.mode == 0) {
        audioRecorder.close(); // disconnect webSocket
    }
}

$('#btnPlay').click(clickPlay);
$('#btnStop').click(clickStop);


function Recorder(source) {

    //////////////////
    // process node
    let recording = false;
    this.node = source.context.createScriptProcessor(4096, 2, 2);
    this.node.onaudioprocess = function (evt) {
        if (!recording) return;
        worker.postMessage({
            command: 'record',
            buffer: [
                evt.inputBuffer.getChannelData(0), // Float32Array
                evt.inputBuffer.getChannelData(1)
            ]
        });
    };
    source.connect(this.node);
    this.node.connect(source.context.destination);

    //////////////////
    // worker
    let worker;
    this.connection = false;
    this.newWorker = function () {
        console.log('create worker');
        worker = new Worker("/js/recWorker.js");
        worker.onmessage = (evt) => {
            switch (evt.data.aType) {
                case 'text':
                    message(this, evt.data.aBuf);
                    break;
                case 'blob':
                    console.log('blob', evt.data.aBuf);
                    break;
                default:
                    throw 'no aType on incoming message to ChromeWorker';
            }
        };
    };

    function message(that, msg) {
        try {
            let json = JSON.parse(msg);
            if (json.cmd == "onFinalResult") {
                clickStop();
                resultMsg(json.msg);
            } else if (json.cmd == "onopen") {
                that.connection = true;
            }
            console.log(json);
        } catch (err) {
            console.log(err.message);
        }
    }

    this.init = function () {
        worker.postMessage({
            command: 'init',
            config: {
                wss: dev_con.wss
            }
        });
    };

    this.clear = function () {
        worker.postMessage({
            command: 'clear'
        });
    };

    this.record = function () {
        recording = true;
        worker.postMessage({
            command: 'startRecord'
        });
    };

    this.stop = function () {
        recording = false;
        worker.postMessage({
            command: 'stopRecord'
        });
    };

    this.close = function () {
        worker.postMessage({
            command: 'close'
        });
        this.connection = false;
    };
}
