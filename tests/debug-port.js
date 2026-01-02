import net from 'node:net';
import { WebSocketServer } from 'ws';

async function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        console.log(`Checking port ${port}...`);

        server.once("error", (err) => {
            console.log(`Check error: ${err.code}`);
            if (err.code === "EADDRINUSE") {
                resolve(false);
            } else {
                resolve(false);
            }
        });

        server.once("listening", () => {
            console.log(`Check listening success`);
            server.close(() => {
                console.log(`Check closed`);
                resolve(true);
            });
        });

        // Try checking specifically on 127.0.0.1
        server.listen(port, '127.0.0.1');
    });
}

async function run() {
    const port = 9225;

    // 1. Start a "Real" server like bridge_server does
    console.log('Starting "Real" server...');
    let realServer = null;
    try {
        realServer = new WebSocketServer({
            port: port,
            host: "127.0.0.1"
        });
        await new Promise((resolve, reject) => {
            realServer.on('listening', resolve);
            realServer.on('error', reject);
        });
        console.log('"Real" server listening on 127.0.0.1:9225');
    } catch (e) {
        console.log(`Could not start "Real" server (expected if already running): ${e.message}`);
    }

    // 2. Run the check
    console.log('Running checkPortAvailability...');
    const isFree = await checkPort(port);
    console.log(`Result: Port is ${isFree ? 'FREE' : 'OCCUPIED'}`);

    if (isFree) {
        console.error('FAIL: Port should be OCCUPIED');
    } else {
        console.log('PASS: Port correctly detected as OCCUPIED');
    }

    if (realServer) realServer.close();
    process.exit(0);
}

run();
