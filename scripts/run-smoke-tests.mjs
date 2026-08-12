import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anonymousFinanceResponse, anonymousSession } from './fixtures/anonymous-finance-data.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = join(projectRoot, 'dist');

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} ${args.join(' ')} failed with exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

// 1. Run auth-sw smoke test (spawns its own mock server)
console.log('--- Starting Auth & SW Smoke Test ---');
await runCommand('node', ['scripts/auth-sw-smoke.mjs']);

// 2. Run manifest, installability, icon, theme, and two-generation PWA smoke test.
console.log('--- Starting PWA Lifecycle Smoke Test ---');
await runCommand('node', ['scripts/pwa-smoke.mjs']);

// 3. Start static preview server for offline and browser smoke tests
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/session') {
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(anonymousSession));
    return;
  }
  if (url.pathname === '/api/finance') {
    await new Promise((resolve) => setTimeout(resolve, 120));
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(anonymousFinanceResponse));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    response.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
    return;
  }
  const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  let filePath = join(distRoot, relativePath);
  if (!filePath.startsWith(distRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
  } catch {
    filePath = join(distRoot, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': filePath.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0',
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500);
    response.end(error instanceof Error ? error.message : String(error));
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('Smoke server did not expose a TCP address');
const smokeUrl = `http://127.0.0.1:${address.port}`;

try {
  console.log('--- Starting Offline Smoke Test ---');
  await runCommand('node', ['scripts/offline-smoke.mjs'], { SMOKE_URL: smokeUrl });

  console.log('--- Starting Browser Smoke Test ---');
  await runCommand('node', ['scripts/browser-smoke.mjs'], { SMOKE_URL: smokeUrl });

  console.log('--- All Smoke Tests Passed Successfully ---');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
