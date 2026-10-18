import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export function createStaticServer(base = dist) {
  base = path.resolve(base);
  return createServer(async (request, response) => {
    const error = (status, message, headers = {}) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      response.end(request.method === 'HEAD' ? undefined : message);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      error(405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      error(400, 'Bad request');
      return;
    }
    if (pathname.includes('\0')) {
      error(400, 'Bad request');
      return;
    }
    const file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + path.sep)) {
      error(403, 'Forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (cause) {
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(cause.code)) {
        error(404, 'Not found');
      } else {
        console.error('Unable to serve asset:', cause);
        error(500, 'Internal server error');
      }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await readFile(path.join(dist, 'index.html'));
  const port = Number(process.env.PORT || 5173);
  const server = createStaticServer();
  server.listen(port, '0.0.0.0', () => console.log(`Zeta Burger listening on port ${port}`));
  const shutdown = () => server.close();
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
