import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const statePath = mkdtempSync(join(tmpdir(), 'staysphere-pms-guest-e2e-'));
const env = {
  ...process.env,
  PMS_PORT: '3002',
  PMS_API_UPSTREAM_PORT: '3002',
  PMS_API_PROXY_PORT: '3001',
  PMS_API_PROXY_CONTROL_PORT: '3101',
  PMS_API_URL: 'http://127.0.0.1:3001',
  STAYSPHERE_LOCAL_STATE_PATH: statePath,
};
const children = [];
let stopping = false;

function stopAll(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') child.kill(signal);
    else {
      try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
process.on('exit', () => rmSync(statePath, { recursive: true, force: true }));

const proxy = spawn(process.execPath, ['apps/guest/scripts/test-pms-proxy.mjs'], {
  cwd: root, env, stdio: 'inherit', detached: process.platform !== 'win32',
});
children.push(proxy);
proxy.on('error', (error) => { console.error('Test PMS proxy failed:', error); process.exitCode = 1; stopAll(); });
proxy.on('exit', (code) => { if (!stopping) { process.exitCode = code ?? 1; stopAll(); } });

const apps = spawn(npm, ['run', 'dev:pms-guest', '--prefix', root], {
  cwd: root, env, stdio: 'inherit', detached: process.platform !== 'win32', shell: process.platform === 'win32',
});
children.push(apps);
apps.on('error', (error) => { console.error('PMS and Guest failed to start:', error); process.exitCode = 1; stopAll(); });
apps.on('exit', (code) => { if (!stopping) { process.exitCode = code ?? 1; stopAll(); } });
