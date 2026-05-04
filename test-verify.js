const http = require('http');

const data = JSON.stringify({
    "email": "victorhugocasulapereira@gmail.com",
    "code": "581957"
});

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/client/verify',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
