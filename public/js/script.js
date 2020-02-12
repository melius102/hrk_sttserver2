// https://192.168.0.11:3000/

let dev_con = {
    mode: 1
};

switch (dev_con.mode) {
    case 0: // kakao_demo
        dev_con.wss = "wss://speech-api.kakao.com:9443/stt";
        break;
    case 1: // local or heroku
        // dev_con.wss = "wss://192.168.0.61:3000";
        dev_con.wss = "wss://melius-stts.herokuapp.com/";
        break;
}

let isInit = false;
let audioContext;
let audioRecorder;
let gainNode;

function resultMsg(msg) {
    searchText.value = msg;
}

function initAudio() {
    if (isInit) return;
    resultMsg('Initializing audio ...');
    if (window.AudioContext) {
        audioContext = new window.AudioContext();
    } else {
        audioContext = new window.webkitAudioContext();
    }

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

    if (!navigator.mediaDevices) {
        alert("Your browser does not support UserMedia. Use other one.");
        return;
    }

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
            // changeBtnMode(1);
            // resultMsg('Press play button to record');
        })
        .catch((err) => {
            console.log("navigator.getUserMedia error: ", err);
        });
}

let resultFlag = 0;

function audioRecorderStart() {
    console.log('audioRecorderStart ...');
    if (audioRecorder.connection) { // webSocket connection > recording
        resultMsg('Speak now');
        resultFlag = 0;
        audioRecorder.clear();
        audioRecorder.record();
    } else if (playState) {
        setTimeout(function () {
            audioRecorderStart();
        }, 1000);
    }
}

let playState = false;
let sid;

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
    clearTimeout(sid);
    sid = setTimeout(clickStop, 15000);
}

function clickStop() {
    if (!isInit || !playState) return;
    clearTimeout(sid);
    playState = false;
    console.log("*****Stop*****");
    // gainNode.gain.value = 0.0;

    audioRecorder.stop();
    if (dev_con.mode == 0) {
        audioRecorder.close(); // disconnect webSocket
    }
    changeBtnMode(1);
    if (resultFlag == 0) resultMsg('');
}

$('#wrap #searchUI .searchBtn').click(function (evt) {
    let index = $(this).index();
    if (index == 0) {
        clickPlay();
    } else if (index == 1) {
        clickPlay();
        changeBtnMode(2);
    } else {
        clickStop();
    }
});

function changeBtnMode(mode) {
    if (mode == 0) {
        $('#wrap #searchUI .searchBtn').hide();
        $('#wrap #searchUI .searchBtn').eq(0).show();
    } else if (mode == 1) {
        $('#wrap #searchUI .searchBtn').hide();
        $('#wrap #searchUI .searchBtn').eq(1).show();
    } else if (mode == 2) {
        $('#wrap #searchUI .searchBtn').hide();
        $('#wrap #searchUI .searchBtn').eq(2).show();
    }
}

let searchWin = [];

function openWindow(query) {
    if (query) {
        searchWin.forEach(v => {
            if (v.act) {
                if (!v.win || v.win.closed) v.win = window.open(v.url + encodeURI(query));
                else v.win.location.href = v.url + encodeURI(query);
            }
        });
    }
}

function Initialize() {
    changeBtnMode(0);
    searchText.value = "Press mic button to activate";

    searchWin.push({
        win: null,
        act: false,
        url: 'https://www.google.com/search?&q='
    });
    searchWin.push({
        win: null,
        act: false,
        url: 'https://search.daum.net/search?&q='
    });
    searchWin.push({
        win: null,
        act: false,
        url: 'https://search.naver.com/search.naver?&query='
    });

    $('#engines .engine').click(function (evt) {
        let index = $(this).index();
        searchWin[index].act = !searchWin[index].act;
        if (searchWin[index].act) {
            $(this).css('filter', 'grayscale(0)');
        } else {
            $(this).css('filter', 'grayscale(0.8)');
        }
    });
}

Initialize();


//////////////
// constructor
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
            if (json.cmd == "onopen") {
                that.connection = true;
                resultMsg('Press play button to record');
                changeBtnMode(1);
            } else if (json.cmd == "onclose") {
                that.connection = false;
                that.init();
            } else if (json.cmd == "finalResult") {
                resultMsg(json.msg);
                resultFlag = 1;
                clickStop();
                openWindow(json.msg);
            } else if (json.cmd == "errorCalled") {
                resultMsg("Fail to recognize, Try again.");
                resultFlag = 1;
                clickStop();
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