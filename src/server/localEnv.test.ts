import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { findLocalEnvFile, mergeMissingEnv, parseEnvFile } from '../../api/_lib/localEnv';

describe('local env files for vercel dev', () => {
  it('parses values and strips surrounding quotes', () => {
    expect(parseEnvFile([
      '# comment',
      'APP_ORIGIN="http://localhost:3000"',
      "ALLOWED_GOOGLE_EMAIL='owner@example.test'",
      'EMPTY=',
      'PLAIN=ok',
    ].join('\n'))).toEqual({
      APP_ORIGIN: 'http://localhost:3000',
      ALLOWED_GOOGLE_EMAIL: 'owner@example.test',
      EMPTY: '',
      PLAIN: 'ok',
    });
  });

  it('fills only missing target keys', () => {
    const target: NodeJS.ProcessEnv = { DATABASE_URL: 'postgres://cloud' };
    expect(mergeMissingEnv(target, {
      DATABASE_URL: 'postgres://file',
      APP_ORIGIN: 'http://localhost:3000',
    })).toEqual(['APP_ORIGIN']);
    expect(target).toMatchObject({
      DATABASE_URL: 'postgres://cloud',
      APP_ORIGIN: 'http://localhost:3000',
    });
  });

  it('finds .env.local by walking up from a nested directory', () => {
    const root = join(tmpdir(), `accura-env-${Date.now()}`);
    const nested = join(root, 'api', '_lib');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.env.local'), 'APP_ORIGIN=http://localhost:3000\n');
    expect(findLocalEnvFile('.env.local', nested)).toBe(join(root, '.env.local'));
  });
});
