import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import { copyPublic, root } from './build.mjs';
const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.build.json'], { stdio: 'inherit', cwd: root });
if (result.status !== 0) process.exit(result.status ?? 1);
await copyPublic();
const watcher = spawn(process.execPath, [compiler, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { stdio: 'inherit', cwd: root });
let timer;
watch(path.join(root, 'public'), { recursive: true }, () => {
  clearTimeout(timer); timer = setTimeout(() => copyPublic().catch(console.error), 120);
});
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const base = path.join(root, 'dist');
    const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + path.sep)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(file));
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
});
const port = Number(process.env.PORT || 5173);
server.listen(port, '0.0.0.0', () => console.log(`Zeta Burger is ready at http://localhost:${port}`));
function cleanup() { watcher.kill(); server.close(); process.exit(); }
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
