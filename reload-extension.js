// Reload Chrome extension remotely
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 9225,
  path: '/reload-extension',
  method: 'POST'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`Response: ${chunk}`);
  });
});

req.on('error', (error) => {
  console.error(`Error: ${error.message}`);
  console.log('\nMake sure the Bridge server is running on port 9225');
});

req.end();
console.log('Sent reload request to extension...');