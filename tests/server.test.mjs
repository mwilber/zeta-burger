import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { createStaticServer } from '../scripts/serve.mjs';

test('production server serves the game and protects the static root', async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'zeta-server-'));
  const base = path.join(folder, 'dist');
  await mkdir(base);
  await writeFile(path.join(folder, 'secret.txt'), 'private');
  await writeFile(path.join(base, 'index.html'), '<h1>Zeta Burger</h1>');
  await writeFile(path.join(base, 'main.js'), 'export {};');
  await writeFile(path.join(base, 'manifest.json'), '{}');
  await writeFile(path.join(base, 'seeker.svg'), '<svg/>');
  const server = createStaticServer(base);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  });
  const get = (url, method = 'GET') => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: url, method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
  const index = await get('/?level=4');
  assert.equal(index.status, 200);
  assert.equal(index.body, '<h1>Zeta Burger</h1>');
  assert.equal(index.headers['cache-control'], 'no-cache');
  for (const [url, type] of [['/main.js', 'text/javascript'], ['/manifest.json', 'application/json'], ['/seeker.svg', 'image/svg+xml']]) {
    const asset = await get(url);
    assert.equal(asset.status, 200);
    assert.ok(asset.headers['content-type'].startsWith(type));
  }
  const head = await get('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], index.headers['content-length']);
  assert.equal((await get('/missing.svg')).status, 404);
  assert.equal((await get('/%2e%2e%2fsecret.txt')).status, 403);
  assert.equal((await get('/%ZZ')).status, 400);
  assert.equal((await get('/%00')).status, 400);
  const post = await get('/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
