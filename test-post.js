const http = require('http');

const data = JSON.stringify({
    "name": "Maria Silva",
    "email": "victorhugocasulapereira@gmail.com",
    "phone": "11999998888",
    "birthDate": "1990-05-15",
    "password": "MariaPassword123!"
});

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/client',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
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
