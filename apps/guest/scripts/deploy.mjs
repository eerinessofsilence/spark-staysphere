#!/usr/bin/env node
/** Deploys the stateless Guest frontend. Hotel data and writes are owned by the PMS Worker. */
import { execFileSync } from 'node:child_process';

const WRANGLER_CONFIG = 'dist/server/wrangler.json';

console.log('Building...');
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
console.log('Deploying Guest. Set the PMS_API_URL Worker variable to the PMS origin.');
execFileSync('npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG], { stdio: 'inherit' });
