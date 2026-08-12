import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultProjectRoot = resolve(dirname(scriptPath), '..');
const defaultPolicyPath = resolve(defaultProjectRoot, 'scripts/third-party-license-policy.json');
const defaultOutputPath = resolve(defaultProjectRoot, 'public/THIRD_PARTY_NOTICES.txt');
const licenseFilePattern = /^(?:licen[cs]e|copying|unlicense)(?:[._-].*)?$/i;
const noticeFilePattern = /^notice(?:[._-].*)?$/i;

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseSpdxExpression(expression) {
  const tokens = expression.match(/[()]|\bAND\b|\bOR\b|\bWITH\b|[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? [];
  if (tokens.join('') !== expression.replace(/\s+/g, '')) throw new Error(`Ungültiger SPDX-Ausdruck: ${expression}`);
  let position = 0;
  const identifiers = [];

  function primary() {
    if (tokens[position] === '(') {
      position += 1;
      disjunction();
      if (tokens[position] !== ')') throw new Error(`Ungültiger SPDX-Ausdruck: ${expression}`);
      position += 1;
      return;
    }
    const identifier = tokens[position];
    if (!identifier || ['AND', 'OR', 'WITH', ')'].includes(identifier)) throw new Error(`Ungültiger SPDX-Ausdruck: ${expression}`);
    identifiers.push(identifier);
    position += 1;
    if (tokens[position] === 'WITH') {
      position += 1;
      const exception = tokens[position];
      if (!exception || ['AND', 'OR', 'WITH', '(', ')'].includes(exception)) throw new Error(`Ungültiger SPDX-Ausdruck: ${expression}`);
      identifiers.push(exception);
      position += 1;
    }
  }

  function conjunction() {
    primary();
    while (tokens[position] === 'AND') {
      position += 1;
      primary();
    }
  }

  function disjunction() {
    conjunction();
    while (tokens[position] === 'OR') {
      position += 1;
      conjunction();
    }
  }

  disjunction();
  if (position !== tokens.length) throw new Error(`Ungültiger SPDX-Ausdruck: ${expression}`);
  return { composite: tokens.some((token) => ['AND', 'OR', 'WITH'].includes(token)), identifiers };
}

function collectDependencyNodes(tree) {
  const nodes = [];
  const visitedPaths = new Set();
  function visit(dependencies = {}) {
    for (const [dependencyName, node] of Object.entries(dependencies)) {
      if (!node || typeof node !== 'object') continue;
      if (typeof node.path === 'string' && typeof node.version === 'string' && !visitedPaths.has(node.path)) {
        visitedPaths.add(node.path);
        nodes.push({ dependencyName, path: node.path, version: node.version });
      }
      visit(node.dependencies);
    }
  }
  visit(tree.dependencies);
  return nodes;
}

function repositoryValue(packageJson) {
  if (typeof packageJson.repository === 'string') return packageJson.repository;
  if (packageJson.repository && typeof packageJson.repository.url === 'string') return packageJson.repository.url;
  return '(nicht angegeben)';
}

async function existingPackageFiles(packagePath, pattern) {
  return (await readdir(packagePath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort(lexicalCompare);
}

async function loadText(projectRoot, packagePath, source) {
  const absolutePath = source.kind === 'override' ? resolve(projectRoot, source.path) : resolve(packagePath, source.path);
  const bytes = await readFile(absolutePath);
  if (bytes.length === 0 || bytes.includes(0) || Buffer.from(bytes.toString('utf8')).compare(bytes) !== 0) {
    throw new Error(`Lizenz- oder NOTICE-Datei ist leer oder kein gültiges UTF-8: ${source.path}`);
  }
  return { bytes, label: source.kind === 'override' ? source.path : source.path };
}

export async function generateThirdPartyNotices({
  projectRoot = defaultProjectRoot,
  dependencyTree,
  lockData,
  policy,
} = {}) {
  const resolvedRoot = resolve(projectRoot);
  const resolvedPolicy = policy ?? JSON.parse(await readFile(resolve(resolvedRoot, 'scripts/third-party-license-policy.json'), 'utf8'));
  const resolvedLock = lockData ?? JSON.parse(await readFile(resolve(resolvedRoot, 'package-lock.json'), 'utf8'));
  const resolvedTree = dependencyTree ?? JSON.parse(execFileSync('npm', ['ls', '--omit=dev', '--all', '--json', '--long'], {
    cwd: resolvedRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }));
  if (!Number.isInteger(resolvedPolicy.maxOutputBytes) || resolvedPolicy.maxOutputBytes <= 0) throw new Error('Die Policy benötigt ein positives maxOutputBytes-Limit.');
  if (!Array.isArray(resolvedPolicy.allowedLicenses)) throw new Error('Die Policy benötigt allowedLicenses.');

  const packages = [];
  for (const node of collectDependencyNodes(resolvedTree)) {
    const packagePath = resolve(node.path);
    const relativePackagePath = relative(resolvedRoot, packagePath).split(sep).join('/');
    if (relativePackagePath.startsWith('../') || !relativePackagePath.startsWith('node_modules/')) {
      throw new Error(`Produktionsabhängigkeit liegt außerhalb von node_modules: ${node.dependencyName}`);
    }
    const lockEntry = resolvedLock.packages?.[relativePackagePath];
    if (!lockEntry || lockEntry.version !== node.version) {
      throw new Error(`package-lock.json und Installation stimmen für ${node.dependencyName}@${node.version} nicht überein.`);
    }
    const packageJson = JSON.parse(await readFile(resolve(packagePath, 'package.json'), 'utf8'));
    if (packageJson.version !== node.version || typeof packageJson.name !== 'string') {
      throw new Error(`Installierte Paketmetadaten stimmen für ${node.dependencyName}@${node.version} nicht überein.`);
    }
    const packageKey = `${packageJson.name}@${packageJson.version}`;
    if (typeof packageJson.license !== 'string' || !packageJson.license.trim()) {
      throw new Error(`${packageKey} besitzt keine Lizenzangabe.`);
    }
    const licenseExpression = packageJson.license.trim();
    const parsedExpression = parseSpdxExpression(licenseExpression);
    const packagePolicy = resolvedPolicy.packages?.[packageKey] ?? {};
    if (parsedExpression.composite) {
      if (packagePolicy.allowedLicenseExpression !== licenseExpression) {
        throw new Error(`${packageKey} verwendet den nicht ausdrücklich freigegebenen Mehrfachlizenzausdruck ${licenseExpression}.`);
      }
    } else if (!resolvedPolicy.allowedLicenses.includes(licenseExpression)) {
      throw new Error(`${packageKey} verwendet die unbekannte oder nicht freigegebene Lizenz ${licenseExpression}.`);
    }
    for (const identifier of parsedExpression.identifiers) {
      if (!resolvedPolicy.allowedLicenses.includes(identifier)) {
        throw new Error(`${packageKey} enthält den unbekannten oder nicht freigegebenen SPDX-Identifier ${identifier}.`);
      }
    }
    if (lockEntry.license && lockEntry.license !== licenseExpression) {
      throw new Error(`Lizenzangabe in package-lock.json und Installation stimmt für ${packageKey} nicht überein.`);
    }

    const discoveredLicenseFiles = await existingPackageFiles(packagePath, licenseFilePattern);
    const licenseSources = Array.isArray(packagePolicy.licenseFiles)
      ? packagePolicy.licenseFiles.map((path) => ({ kind: 'override', path }))
      : discoveredLicenseFiles.map((path) => ({ kind: 'package', path }));
    if (licenseSources.length === 0) throw new Error(`Für ${packageKey} konnte kein mitgelieferter oder explizit freigegebener Lizenztext aufgelöst werden.`);

    const discoveredNoticeFiles = await existingPackageFiles(packagePath, noticeFilePattern);
    for (const requiredNotice of packagePolicy.requiredNoticeFiles ?? []) {
      if (!discoveredNoticeFiles.includes(requiredNotice)) throw new Error(`Für ${packageKey} fehlt der erforderliche NOTICE-Text ${requiredNotice}.`);
    }
    const [licenses, notices] = await Promise.all([
      Promise.all(licenseSources.map((source) => loadText(resolvedRoot, packagePath, source))),
      Promise.all(discoveredNoticeFiles.map((path) => loadText(resolvedRoot, packagePath, { kind: 'package', path }))),
    ]);
    packages.push({
      homepage: typeof packageJson.homepage === 'string' ? packageJson.homepage : '(nicht angegeben)',
      licenseExpression,
      licenses,
      name: packageJson.name,
      notices,
      packageKey,
      repository: repositoryValue(packageJson),
      version: packageJson.version,
    });
  }

  packages.sort((left, right) => lexicalCompare(left.name, right.name) || lexicalCompare(left.version, right.version));
  const textGroups = new Map();
  for (const packageEntry of packages) {
    for (const [kind, entries] of [['LICENSE', packageEntry.licenses], ['NOTICE', packageEntry.notices]]) {
      for (const entry of entries) {
        const hash = createHash('sha256').update(entry.bytes).digest('hex');
        const key = `${kind}:${hash}`;
        const group = textGroups.get(key) ?? { bytes: entry.bytes, kind, packages: [], sources: [] };
        group.packages.push(packageEntry.packageKey);
        group.sources.push(`${packageEntry.packageKey}/${entry.label}`);
        textGroups.set(key, group);
      }
    }
  }

  const chunks = [
    'ACCURA – THIRD-PARTY NOTICES\n',
    'This file covers the production dependency graph installed from package-lock.json.\n',
    'It is generated deterministically; edit the policy or installed dependencies, not this file.\n\n',
    'PACKAGE INDEX\n',
    '=============\n\n',
  ];
  for (const packageEntry of packages) {
    chunks.push(`${packageEntry.packageKey}\n`);
    chunks.push(`  License: ${packageEntry.licenseExpression}\n`);
    chunks.push(`  Repository: ${packageEntry.repository}\n`);
    chunks.push(`  Homepage: ${packageEntry.homepage}\n\n`);
  }
  const groups = [...textGroups.values()].sort((left, right) => {
    const leftPackages = [...new Set(left.packages)].sort(lexicalCompare).join(', ');
    const rightPackages = [...new Set(right.packages)].sort(lexicalCompare).join(', ');
    return lexicalCompare(left.kind, right.kind) || lexicalCompare(leftPackages, rightPackages);
  });
  for (const [index, group] of groups.entries()) {
    const groupedPackages = [...new Set(group.packages)].sort(lexicalCompare);
    const groupedSources = [...new Set(group.sources)].sort(lexicalCompare);
    chunks.push('='.repeat(78), '\n');
    chunks.push(`${group.kind} TEXT ${index + 1}\n`);
    chunks.push(`Applies to: ${groupedPackages.join(', ')}\n`);
    chunks.push(`Source files: ${groupedSources.join(', ')}\n`);
    chunks.push('-'.repeat(78), '\n');
    chunks.push(group.bytes.toString('utf8'));
    if (!group.bytes.toString('utf8').endsWith('\n')) chunks.push('\n');
    chunks.push('\n');
  }
  const output = Buffer.from(chunks.join(''), 'utf8');
  if (output.length > resolvedPolicy.maxOutputBytes) {
    throw new Error(`THIRD_PARTY_NOTICES.txt ist ${output.length} Bytes groß und überschreitet das Limit von ${resolvedPolicy.maxOutputBytes} Bytes.`);
  }
  return output;
}

export async function assertCheckedInNotices(expectedPath, generatedOutput) {
  let checkedIn;
  try {
    checkedIn = await readFile(expectedPath);
  } catch {
    throw new Error(`${expectedPath} fehlt. Führe npm run licenses:generate aus.`);
  }
  if (Buffer.compare(checkedIn, generatedOutput) !== 0) {
    throw new Error(`${expectedPath} ist veraltet. Führe npm run licenses:generate aus.`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (!['--check', '--write'].includes(mode) || process.argv.length !== 3) {
    throw new Error('Aufruf: generate-third-party-notices.mjs --write|--check');
  }
  const output = await generateThirdPartyNotices({
    projectRoot: defaultProjectRoot,
    policy: JSON.parse(await readFile(defaultPolicyPath, 'utf8')),
  });
  if (mode === '--write') {
    await writeFile(defaultOutputPath, output);
    console.log(`Drittanbieterhinweise geschrieben (${output.length} Bytes).`);
  } else {
    await assertCheckedInNotices(defaultOutputPath, output);
    console.log(`Drittanbieterhinweise sind aktuell (${output.length} Bytes).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
