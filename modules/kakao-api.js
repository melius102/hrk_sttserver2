const https = require('https');
// const fiddler = require('./fiddler');

const pKeys = require('./private_keys');

const apikey = pKeys.apikey;

//////////////
// translation
// const querystring = require('querystring');
// const postData = querystring.stringify({ 'msg': 'Hello World!' });\
// https://nodejs.dev/making-http-requests-with-nodejs
// https://nodejs.org/ko/docs/guides/anatomy-of-an-http-transaction/
function translation_kakao(src_lang, target_lang, query, cb) {
    const params = {
        src_lang,
        target_lang,
        query: encodeURI(query)
    };

    // const data = JSON.stringify(params);
    const queryString = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
    const options = {
        protocol: 'https:',
        hostname: 'kapi.kakao.com',
        method: 'POST',
        path: '/v1/translation/translate', // '?' + queryString,
        headers: {
            'Authorization': `KakaoAK ${apikey}`,
            'Content-Type': 'application/x-www-form-urlencoded', // 'application/json',
            'Content-Length': queryString.length
        }
    };

    // const req = fiddler.request2(options, function (res) {
    const req = https.request(options, function (res) {
        // console.log('statusCode:', res.statusCode);
        // console.log('headers:', res.headers);

        var body;
        res.on('data', function (chunk) {
            if (!body) body = chunk;
            else body += chunk;
        });
        res.on('end', function () {
            try {
                // let data = JSON.parse(body.substring(body.indexOf('{')));
                let data = JSON.parse(body);
                // console.log("buffer: ", body.toString()); // Buffer.toString()
                console.log("kakao: ", data.translated_text);
                cb(data.translated_text[0][0]);
            } catch (e) {
                console.log('catch error:');
                console.error(e);
            }
        });
        // console.log(Object.keys(res));
        // console.log(res.headers);
        // console.log('status:', res.statusMessage, res.statusCode);
    });

    req.on('error', (e) => {
        console.error(e);
    });
    req.write(queryString);
    req.end();
}


// const Transform = require('stream').Transform;
// const fs = require('fs');

/////////////////
// text-to-speech
function tts_kakao(query, cb) { // newtonetalk
    const postData = `<speak>${query}</speak>`;
    const options = {
        protocol: 'https:',
        hostname: 'kakaoi-newtone-openapi.kakao.com',
        method: 'POST',
        path: '/v1/synthesize',
        headers: {
            'Content-Type': 'application/xml',
            'Authorization': `KakaoAK ${apikey}`,
            'Content-Length': Buffer.byteLength(postData),
            // 'Connection': 'keep-alive'
        },
        // proxy: 'http://127.0.0.1:8888'
        // encoding: 'binary'
    };

    const req = https.request(options, function (res) {

        // method 1
        // const encoding = "binary"; // 'binary', 'hex'
        // let body;
        // res.on('data', function (chunk) {
        //     if (!body) body = chunk.toString(encoding);
        //     else body += chunk.toString(encoding);
        // });

        // method 2
        // let data = new Transform();
        // res.on('data', function (chunk) {
        //     data.push(chunk);
        // });

        // method 3
        let data = [];
        res.on('data', function (chunk) {
            data.push(chunk);
        });

        res.on('end', function () {
            // let buffer = Buffer.from(body, encoding); // method 1
            // let buffer = data.read(); // method 2
            let buffer = Buffer.concat(data); // method 3

            cb(buffer);
            // make file
            // console.log(buffer);
            // try {
            //     let rnd = Math.floor(Math.random() * 90) + 10; // 10 ~ 99
            //     fs.writeFile(`result_${Date.now()}_${rnd}.mp3`, buffer, function (err) {
            //         if (err) {
            //             console.error(err);
            //         } else {
            //             console.log("kakao: ok");
            //             // console.log(body);
            //         }
            //     });
            // } catch (e) {
            //     console.log('catch error:');
            //     console.error(e);
            // }
        });
    });

    req.on('error', (e) => {
        console.error(e);
    });
    req.write(postData);
    req.end();
}


/////////////////
// speech-to-text
function stt_kakao(readData, cb) { // newtone, from file
    const options = {
        protocol: 'https:',
        hostname: 'kakaoi-newtone-openapi.kakao.com',
        method: 'POST',
        path: '/v1/recognize',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-DSS-Service': 'DICTATION',
            'Authorization': `KakaoAK ${apikey}`,
            // 'Content-Length': Buffer.byteLength(postData),
            // 'Connection': 'keep-alive'
        },
        // body: fs.createReadStream('heykakao.wav')
        // encoding: 'binary'
    };

    // const req = fiddler.request2(options, function (res) {
    const req = https.request(options, function (res) {
        let body;
        let boundary = res.headers['content-type'].split(';')[1].trim().split('=')[1];
        // console.log('boundary:', boundary);
        res.on('data', function (chunk) {
            if (!body) body = chunk;
            else body += chunk;
            // console.log('***************************');
            // console.log(chunk.toString());
            cb(chunk_parser(chunk.toString(), boundary)); // callback method 2
        });

        res.on('end', function () {
            // console.log(body);
            // cb(multi_parser(body, boundary)); // callback method 1
        });
    });

    req.on('error', (e) => {
        console.log('error:');
        console.error(e);
    });

    let cname = Object.getPrototypeOf(readData).constructor.name;
    if (cname == 'Buffer') { // var readFS = fs.readFileSync('heykakao.wav');

        // method 1
        // console.log(Object.getPrototypeOf(readFS).constructor.name); // Buffer
        req.write(readData); // or req.write(Buffer.from(readData));
        req.end();
    } else if (cname == 'ReadStream') { // var readStream = fs.createReadStream('heykakao.wav');

        // method 2
        // readData.pipe(req).on('end', () => {
        //     req.end();
        // });

        // method 3 ok
        readData.on('data', (data) => {
            req.write(data);
        }).on('end', () => {
            req.end();
        });
    } else if (cname == 'Readable') { // from buffer stream
        readData.pipe(req).on('end', () => {
            req.end();
        });
    }
}

function chunk_parser(body, boundary) {
    try {
        let chunk = body.split('--' + boundary);
        let chunk1;
        for (let i = 0; i < chunk.length; i++) {
            chunk[i] = chunk[i].split('\r\n');
            let chunk2 = {};
            let flag = false;
            for (let j = 0; j < chunk[i].length; j++) {
                if (chunk[i][j] != '' && chunk[i][j] != '--') {
                    flag = true;
                    try {
                        chunk2.data = JSON.parse(chunk[i][j]);
                    } catch (e) {
                        let tmp = chunk[i][j].split(':');
                        chunk2[tmp[0].trim()] = tmp[1].trim();
                    }
                }
            }
            if (flag) {
                // return chunk2;
                chunk1 = chunk2;
            }
        }
        return chunk1;
    } catch (e) {
        console.error(e);
        console.log(body.toString());
    }
}

function multi_parser(body, boundary) {
    let result = null;
    // console.log('boundary: ', boundary);
    try {
        let chunk = body.split('--' + boundary);
        let chunk1 = [];
        for (let i = 0; i < chunk.length; i++) {
            chunk[i] = chunk[i].split('\r\n');
            let chunk2 = {};
            let flag = false;
            for (let j = 0; j < chunk[i].length; j++) {
                if (chunk[i][j] != '' && chunk[i][j] != '--') {
                    flag = true;
                    try {
                        chunk2.data = JSON.parse(chunk[i][j]);
                    } catch (e) {
                        let tmp = chunk[i][j].split(':');
                        chunk2[tmp[0].trim()] = tmp[1].trim();
                    }
                }
            }
            if (flag) {
                chunk1.push(chunk2);
            }
        }
        // console.log(chunk1);
        for (let i = 0; i < chunk1.length; i++) {
            if (chunk1[i]['data'].type == "finalResult") {
                // result = chunk1[i]['data'].value;
                result = {
                    cmd: "finalResult",
                    msg: chunk1[i]['data'].value
                };
            }
        }
    } catch (e) {
        console.error(e);
        console.log(body.toString());
    }
    return result;
}

let kakao_api = {
    translation_kakao,
    tts_kakao,
    stt_kakao,
};

module.exports = kakao_api;