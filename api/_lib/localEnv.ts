import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_ENV_FILES = ['.env.local', '.env'];

export function parseEnvFile(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    if (!key || key.startsWith('export ')) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function mergeMissingEnv(target: NodeJS.ProcessEnv, parsed: Record<string, string>): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!value) continue;
    if (target[key]?.trim()) continue;
    target[key] = value;
    applied.push(key);
  }
  return applied;
}

function searchAncestors(start: string, fileName: string): string | null {
  let directory = start;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(directory, fileName);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

export function findLocalEnvFile(fileName: string, fromDirectory = process.cwd()): string | null {
  const starts = [fromDirectory];
  try {
    starts.push(fileURLToPath(new URL('.', import.meta.url)));
  } catch {
    // import.meta.url is always available in this ESM module; keep the search cwd-only if not.
  }
  for (const start of starts) {
    const found = searchAncestors(start, fileName);
    if (found) return found;
  }
  return null;
}

export function applyLocalEnvFiles(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VERCEL_ENV?.trim() === 'production') return;
  for (const fileName of LOCAL_ENV_FILES) {
    const path = findLocalEnvFile(fileName);
    if (!path) continue;
    mergeMissingEnv(env, parseEnvFile(readFileSync(path, 'utf8')));
  }
}
