// const request = require("request");
// const cheerio = require("cheerio");

//////////////
// translation
// function translation_google(src_lang, target_lang, query, cb) {
//     query = encodeURI(query);
//     request.get({
//         url: `https://translate.google.com`
//     }, function (err, res, body) {

//     });
// }

function crawling_google(https, query, cb) {
    const options = {
        hostname: 'www.google.com',
    };

    const req = https.get(options, function (res) {
        let body;
        res.on('data', function (chunk) {
            if (!body) body = chunk;
            else body += chunk;
        });

        res.on('end', function () {
            console.log('send body');
            cb(body)
        });
    });
}


let crawling = {
    crawling_google
};

module.exports = crawling;