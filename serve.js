const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3003;
const DIR = __dirname;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.json': 'application/json',
};

http.createServer((req, res) => {
    let file = req.url === '/' ? '/index.html' : req.url;
    file = path.join(DIR, file);

    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const ext = path.extname(file);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => console.log(`Lenia serving on http://localhost:${PORT}`));
