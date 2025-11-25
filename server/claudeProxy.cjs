const http = require('http');
const https = require('https');

const PORT = 3001;

const server = http.createServer((req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, anthropic-beta');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/claude') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const options = {
                hostname: 'api.anthropic.com',
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': req.headers['x-api-key'],
                    'anthropic-version': req.headers['anthropic-version'],
                }
            };

            if (req.headers['anthropic-beta']) {
                options.headers['anthropic-beta'] = req.headers['anthropic-beta'];
            }

            const proxyReq = https.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (e) => {
                console.error(`Problem with request: ${e.message}`);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Claude proxy listening on port ${PORT}`);
});
