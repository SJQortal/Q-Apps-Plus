/**
 * Runs inside the testnet's network namespace (loopback only), next to the
 * node: forwards a Unix socket in the testnet home to the node's API port,
 * so tools outside the namespace can reach this node and nothing else.
 *
 *   node bridge.mjs <socketPath> <apiPort>
 */
import fs from 'node:fs';
import net from 'node:net';

const [socketPath, apiPort] = process.argv.slice(2);
if (!socketPath || !apiPort) {
  console.error('usage: bridge.mjs <socketPath> <apiPort>');
  process.exit(2);
}
try {
  fs.unlinkSync(socketPath);
} catch {
  // none yet
}
const server = net.createServer((client) => {
  const upstream = net.connect(Number(apiPort), '127.0.0.1');
  client.pipe(upstream).pipe(client);
  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on('error', close);
  upstream.on('error', close);
});
server.listen(socketPath, () => fs.chmodSync(socketPath, 0o600));
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
