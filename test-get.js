const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/client',
    method: 'GET'
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body));
});

req.on('error', error => console.error(error));
req.end();
