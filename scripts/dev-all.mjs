import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pmsPort = process.env.PMS_PORT ?? '3001';
const availableApps = [
  { id: 'pms', name: 'PMS', workspace: '@staysphere/pms', port: pmsPort },
  { id: 'guest', name: 'Guest', workspace: '@staysphere/guest', port: process.env.GUEST_PORT ?? '3000' },
  { id: 'site', name: 'Site', workspace: '@staysphere/site', port: null },
];
const requestedApps = process.argv.slice(2);
const apps = requestedApps.length
  ? requestedApps.map((id) => {
      const app = availableApps.find((candidate) => candidate.id === id);
      if (!app) throw new Error(`Unknown app "${id}". Choose from: ${availableApps.map(({ id: appId }) => appId).join(', ')}`);
      return app;
    })
  : availableApps;
const children = [];
let stopping = false;

async function waitForPms() {
  const deadline = Date.now() + 120_000;
  const pmsUrl = `http://localhost:${pmsPort}/api/public/catalog`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(pmsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'hotel', hotelSlug: 'asteria-cove' }),
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      await response.body?.cancel();
    } catch {
      // PMS may still be starting its Worker and local database.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  stopAll();
  throw new Error(`PMS did not become ready at ${pmsUrl}`);
}

function stopAll(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (!child.pid) continue;

    if (process.platform === 'win32') {
      child.kill(signal);
    } else {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  }
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));

for (const [index, app] of apps.entries()) {
  const args = ['run', 'dev', `--workspace=${app.workspace}`];
  if (app.port) args.push('--', '--port', app.port);
  if (process.env.DEV_HOST) args.push('--host', process.env.DEV_HOST, '--strictPort');

  const child = spawn(npm, args, {
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    shell: process.platform === 'win32',
  });
  children.push(child);

  child.on('error', (error) => {
    console.error(`${app.name} failed to start:`, error);
    process.exitCode = 1;
    stopAll();
  });

  child.on('exit', (code) => {
    if (stopping) return;
    process.exitCode = code ?? 1;
    stopAll();
  });

  if (app.id === 'pms' && apps[index + 1]?.id === 'guest') {
    await waitForPms();
  }
}
