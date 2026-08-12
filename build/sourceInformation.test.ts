import { describe, expect, it } from 'vitest';
import { resolveSourceInformation } from './sourceInformation';

const explicitSha = 'a'.repeat(40);
const vercelSha = 'b'.repeat(40);
const localSha = 'c'.repeat(40);

describe('resolveSourceInformation', () => {
  it('gives explicit build overrides precedence', () => {
    const result = resolveSourceInformation({
      command: 'build',
      environment: {
        ACCURA_SOURCE_COMMIT_SHA: explicitSha,
        ACCURA_SOURCE_REPOSITORY_URL: 'https://github.com/example/override.git',
        VITE_VERCEL_GIT_COMMIT_SHA: vercelSha,
        VITE_VERCEL_GIT_REPO_OWNER: 'ignored',
        VITE_VERCEL_GIT_REPO_SLUG: 'ignored',
      },
      readLocalCommit: () => localSha,
    });
    expect(result.sourceUrl).toBe(`https://github.com/example/override/tree/${explicitSha}`);
  });

  it('uses the complete Vercel revision', () => {
    const result = resolveSourceInformation({
      command: 'build',
      environment: {
        VITE_VERCEL_GIT_COMMIT_SHA: vercelSha,
        VITE_VERCEL_GIT_REPO_OWNER: 'hernstev97',
        VITE_VERCEL_GIT_REPO_SLUG: 'accura',
      },
    });
    expect(result.commitSha).toBe(vercelSha);
    expect(result.shortSha).toBe('bbbbbbb');
    expect(result.sourceUrl).toBe(`https://github.com/hernstev97/accura/tree/${vercelSha}`);
  });

  it('uses the local commit for a local production build', () => {
    const result = resolveSourceInformation({ command: 'build', environment: {}, readLocalCommit: () => localSha });
    expect(result.sourceUrl).toBe(`https://github.com/hernstev97/accura/tree/${localSha}`);
  });

  it('fails a production build without an immutable revision', () => {
    expect(() => resolveSourceInformation({ command: 'build', environment: {}, readLocalCommit: () => undefined }))
      .toThrow(/Produktionsbuild abgebrochen/);
  });

  it('rejects incomplete and invalid revisions', () => {
    expect(() => resolveSourceInformation({
      command: 'build',
      environment: { ACCURA_SOURCE_COMMIT_SHA: 'short' },
    })).toThrow(/gemeinsam gesetzt/);
    expect(() => resolveSourceInformation({
      command: 'build',
      environment: {
        ACCURA_SOURCE_COMMIT_SHA: 'short',
        ACCURA_SOURCE_REPOSITORY_URL: 'https://github.com/hernstev97/accura',
      },
    })).toThrow(/40-stelligen/);
  });

  it('allows only the development server to fall back to master', () => {
    const result = resolveSourceInformation({ command: 'serve', environment: {}, readLocalCommit: () => undefined });
    expect(result).toMatchObject({ commitSha: '', shortSha: 'master' });
    expect(result.sourceUrl).toBe('https://github.com/hernstev97/accura/tree/master');
  });
});
