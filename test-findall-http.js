const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/client',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InZpY3Rvcmh1Z29Ac3R1ZGlvYS5jb20iLCJzdWIiOiI4ZWMzYWY5Ny01M2RkLTRhNzMtYjVhZC05NWFjNjAwMjRjOTQiLCJyb2xlIjoiTUFOQUdFUiIsImlhdCI6MTc3ODA5MDYzMCwiZXhwIjoxNzc4MTE5NDMwfQ.r0XRoCGCt11e_otK02WwwTNa7kEmUtJxfYtKT74R2tU'
    }
};

const req = http.request(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body));
});

req.on('error', error => console.error(error));
req.end();
