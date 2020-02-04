const https = require('https');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// https://192.168.0.11:3000/

app.use(express.urlencoded({
    extended: false
}));
app.use(express.json());
app.use('/', express.static('./public'));

app.get('/', (req, res) => {
    // res.send(data);
    res.sendFile(__dirname + '/public/index.html');
});

const privateKey = fs.readFileSync('openssl/private.pem');
const certificate = fs.readFileSync('openssl/public.pem');
const credentials = {
    key: privateKey,
    cert: certificate
};

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, function () {
    console.log("HTTPS server listening on port " + port);
});
