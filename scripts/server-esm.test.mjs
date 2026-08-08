import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const findJavaScriptFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });

test('compiled server modules are resolvable by plain Node ESM', () => {
  const temporaryRoot = join(projectRoot, 'node_modules', '.tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const outputRoot = mkdtempSync(join(temporaryRoot, 'server-esm-'));

  try {
    execFileSync(process.execPath, [
      join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--project', join(projectRoot, 'tsconfig.server.json'),
      '--noEmit', 'false',
      '--outDir', outputRoot,
      '--tsBuildInfoFile', join(outputRoot, 'tsconfig.server.tsbuildinfo'),
    ], { cwd: projectRoot, stdio: 'inherit' });

    const emittedApiRoot = join(outputRoot, 'api');
    const emittedModules = findJavaScriptFiles(outputRoot).sort();
    assert.ok(
      emittedModules.some((modulePath) => modulePath.startsWith(`${emittedApiRoot}/`)),
      'Expected the server compilation to emit API modules.',
    );

    const importScript = `
      import { pathToFileURL } from 'node:url';
      for (const modulePath of process.argv.slice(1)) {
        await import(pathToFileURL(modulePath).href);
      }
    `;
    execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', importScript, ...emittedModules],
      { cwd: projectRoot, stdio: 'inherit' },
    );
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
