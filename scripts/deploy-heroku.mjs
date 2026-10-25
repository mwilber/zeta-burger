import { readFile, appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

// Upload a git archive rather than pushing to Heroku's Git remote. This also
// works for private repositories without giving Heroku a GitHub credential.
export async function deployHeroku({ app, token, archive, version }, {
  fetch: request = fetch, wait = delay, log = console.log,
} = {}) {
  if (!app || !token) throw new Error('HEROKU_APP_NAME and HEROKU_API_KEY are required.');
  const appPath = `/apps/${encodeURIComponent(app)}`;
  const api = async (path, body) => {
    const response = await request(`https://api.heroku.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Accept: 'application/vnd.heroku+json; version=3',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000),
    });
    // API responses contain signed source URLs; do not dump them into CI logs.
    if (!response.ok) throw new Error(`Heroku API ${path} failed (HTTP ${response.status}).`);
    return response.json();
  };

  const { source_blob: source } = await api('/sources', {});
  const upload = await request(source.put_url, {
    method: 'PUT', body: archive,
    headers: { 'Content-Type': '' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!upload.ok) throw new Error(`Heroku source upload failed (HTTP ${upload.status}).`);

  let build = await api(`${appPath}/builds`, {
    source_blob: { url: source.get_url, version },
  });
  log(`Building ${version} on ${app}; build ${build.id}.`);
  // Heroku automatically releases successful builds. Keep the workflow's
  // concurrency lock until the remote build finishes, including transient
  // polling failures, so the next request cannot race this release.
  for (let poll = 0; build.status === 'pending' && poll < 240; poll++) {
    await wait(10_000);
    try {
      build = await api(`${appPath}/builds/${build.id}`);
    } catch (error) {
      log(`${error.message} Waiting before checking the existing build again.`);
    }
  }
  if (build.status !== 'succeeded') {
    throw new Error(`Heroku build ${build.id} ${build.status}. See https://dashboard.heroku.com/apps/${app}/activity for build logs.`);
  }
  log(`Released ${version} on ${app}.`);
  return build;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [archivePath, version] = process.argv.slice(2);
  if (!archivePath || !/^[a-f0-9]{40}$/.test(version ?? '')) {
    throw new Error('Usage: node scripts/deploy-heroku.mjs <source.tar.gz> <commit-sha>');
  }
  const app = process.env.HEROKU_APP_NAME;
  await deployHeroku({
    app, token: process.env.HEROKU_API_KEY,
    archive: await readFile(archivePath), version,
  });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `Deployed commit \`${version}\` to [${app}](https://dashboard.heroku.com/apps/${app}).\n`);
  }
}
