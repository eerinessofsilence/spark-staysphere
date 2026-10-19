import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = ['cms', 'guest', 'site'].map((app) => spawn('npm', ['run', `dev:${app}`], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, CMS_API_URL: process.env.CMS_API_URL || 'http://localhost:3101', GUEST_APP_URL: process.env.GUEST_APP_URL || 'http://localhost:3100' },
}));
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code || 1); });
}
