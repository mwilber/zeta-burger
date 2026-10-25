import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deployHeroku } from '../scripts/deploy-heroku.mjs';

function harness({ failUpload = false, failBuild = false, transientPoll = false } = {}) {
  const calls = [];
  const logs = [];
  let polls = 0;
  const json = (body) => Response.json(body);
  return {
    calls, logs,
    options: {
      log: message => logs.push(message),
      wait: async () => {},
      fetch: async (url, options) => {
        calls.push({ url, ...options });
        if (url.endsWith('/sources')) {
          return json({ source_blob: {
            put_url: 'https://upload.example/source?secret=signed-upload',
            get_url: 'https://download.example/source?secret=signed-download',
          } });
        }
        if (url.startsWith('https://upload.example/')) {
          return new Response(null, { status: failUpload ? 403 : 200 });
        }
        if (url.endsWith('/builds')) return json({ id: 'build-1', status: 'pending' });
        assert.ok(url.endsWith('/builds/build-1'));
        polls++;
        if (transientPoll && polls === 1) return new Response(null, { status: 503 });
        return json({ id: 'build-1', status: failBuild ? 'failed' : 'succeeded' });
      },
    },
  };
}

const input = {
  app: 'zeta-burger', token: 'private-token', archive: Buffer.from('source archive'),
  version: 'a'.repeat(40),
};

test('deployment uploads the selected source and waits through polling failures for its release', async () => {
  const mock = harness({ transientPoll: true });
  const build = await deployHeroku(input, mock.options);
  assert.equal(build.status, 'succeeded');
  const upload = mock.calls.find(call => call.method === 'PUT');
  assert.equal(upload.body, input.archive);
  assert.equal(upload.headers.Authorization, undefined, 'do not send Heroku credentials to storage');
  const create = mock.calls.find(call => call.url.endsWith('/builds'));
  assert.deepEqual(JSON.parse(create.body).source_blob, {
    url: 'https://download.example/source?secret=signed-download', version: input.version,
  });
  assert.equal(mock.calls.filter(call => call.url.endsWith('/builds')).length, 1);
  assert.equal(mock.calls.filter(call => call.url.endsWith('/builds/build-1')).length, 2);
  assert.match(mock.logs.at(-1), /Released/);
  assert.doesNotMatch(mock.logs.join('\n'), /private-token|signed-upload|signed-download/);
});

test('a failed source upload never starts a remote build', async () => {
  const mock = harness({ failUpload: true });
  await assert.rejects(deployHeroku(input, mock.options), /upload failed \(HTTP 403\)/);
  assert.ok(mock.calls.every(call => !call.url.endsWith('/builds')));
});

test('a failed Heroku build fails deployment instead of reporting a release', async () => {
  const mock = harness({ failBuild: true });
  await assert.rejects(deployHeroku(input, mock.options), /build-1 failed/);
  assert.ok(mock.logs.every(message => !message.startsWith('Released')));
});
