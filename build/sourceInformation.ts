import { execFileSync } from 'node:child_process';

const CANONICAL_REPOSITORY_URL = 'https://github.com/hernstev97/accura';
const FULL_SHA = /^[0-9a-f]{40}$/i;
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/[^/]+\/[^/]+$/;

type SourceEnvironment = Record<string, string | undefined>;

export type SourceInformation = {
  commitSha: string;
  repositoryUrl: string;
  shortSha: string;
  sourceUrl: string;
};

type ResolveSourceInformationOptions = {
  command: 'build' | 'serve';
  cwd?: string;
  environment?: SourceEnvironment;
  readLocalCommit?: (cwd: string) => string | undefined;
};

function normalizeRepositoryUrl(value: string): string {
  const normalized = value.trim().replace(/\.git$/, '').replace(/\/$/, '');
  if (!GITHUB_REPOSITORY.test(normalized)) {
    throw new Error(`Ungültige GitHub-Repository-URL für den Source-Link: ${value}`);
  }
  return normalized;
}

function exactRevision(repositoryUrl: string, commitSha: string): SourceInformation {
  const normalizedRepository = normalizeRepositoryUrl(repositoryUrl);
  const normalizedSha = commitSha.trim().toLowerCase();
  if (!FULL_SHA.test(normalizedSha)) {
    throw new Error('Der Source-Link benötigt einen vollständigen 40-stelligen Git-Commit-SHA.');
  }
  return {
    commitSha: normalizedSha,
    repositoryUrl: normalizedRepository,
    shortSha: normalizedSha.slice(0, 7),
    sourceUrl: `${normalizedRepository}/tree/${normalizedSha}`,
  };
}

function defaultReadLocalCommit(cwd: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

export function resolveSourceInformation({
  command,
  cwd = process.cwd(),
  environment = process.env,
  readLocalCommit = defaultReadLocalCommit,
}: ResolveSourceInformationOptions): SourceInformation {
  const explicitRepository = environment.ACCURA_SOURCE_REPOSITORY_URL;
  const explicitCommit = environment.ACCURA_SOURCE_COMMIT_SHA;
  if (explicitRepository || explicitCommit) {
    if (!explicitRepository || !explicitCommit) {
      throw new Error('ACCURA_SOURCE_REPOSITORY_URL und ACCURA_SOURCE_COMMIT_SHA müssen gemeinsam gesetzt werden.');
    }
    return exactRevision(explicitRepository, explicitCommit);
  }

  const vercelOwner = environment.VITE_VERCEL_GIT_REPO_OWNER;
  const vercelRepository = environment.VITE_VERCEL_GIT_REPO_SLUG;
  const vercelCommit = environment.VITE_VERCEL_GIT_COMMIT_SHA;
  if (vercelOwner || vercelRepository || vercelCommit) {
    if (!vercelOwner || !vercelRepository || !vercelCommit) {
      throw new Error('Die Vercel-Git-Buildvariablen sind unvollständig.');
    }
    return exactRevision(`https://github.com/${vercelOwner}/${vercelRepository}`, vercelCommit);
  }

  const localCommit = readLocalCommit(cwd);
  if (localCommit) return exactRevision(CANONICAL_REPOSITORY_URL, localCommit);
  if (command === 'build') {
    throw new Error('Produktionsbuild abgebrochen: Es konnte kein vollständiger Source-Commit ermittelt werden.');
  }

  return {
    commitSha: '',
    repositoryUrl: CANONICAL_REPOSITORY_URL,
    shortSha: 'master',
    sourceUrl: `${CANONICAL_REPOSITORY_URL}/tree/master`,
  };
}
