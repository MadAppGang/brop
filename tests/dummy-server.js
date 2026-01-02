import net from 'node:net';

const port = 9225;
const server = net.createServer();

server.listen(port, () => {
    console.log(`Dummy server listening on port ${port}`);
    // Keep process alive
    setInterval(() => {}, 1000);
});

server.on('error', (err) => {
    console.error('Dummy server error:', err);
    process.exit(1);
});

// Handle termination gracefully-ish
process.on('SIGTERM', () => {
    console.log('Dummy server received SIGTERM');
    process.exit(0);
});
