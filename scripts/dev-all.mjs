import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const availableApps = [
  { id: 'pms', name: 'PMS', workspace: '@staysphere/pms', port: '3001' },
  { id: 'guest', name: 'Guest', workspace: '@staysphere/guest', port: '3000' },
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

for (const app of apps) {
  const args = ['run', 'dev', `--workspace=${app.workspace}`];
  if (app.port) args.push('--', '--port', app.port);

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
}
