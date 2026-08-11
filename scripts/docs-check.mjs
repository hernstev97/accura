#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const externalMode = process.argv.includes('--external');
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'test-results', 'playwright-report']);
const errors = [];
const warnings = [];
const externalLinks = new Set();
const documents = new Map();

const legacyPaths = new Map([
  ['USER_SETUP.md', 'docs/anleitungen/produktions-setup.md'],
  ['PROGRESS.md', 'docs/produkt/entwicklungsstand.md'],
  ['docs/design-system.md', 'docs/architektur/appearance-und-designsystem.md'],
  ['docs/security-and-data-flow.md', 'docs/architektur/backend-und-sicherheit.md'],
  ['docs/finance-data-schema-v1.md', 'docs/referenz/finance-data-schema-v1.md'],
  ['docs/google-oauth-vercel-setup.md', 'docs/anleitungen/produktions-setup.md'],
]);

const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const location = (file, line) => `${relative(file)}:${line}`;

async function collectMarkdown(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectMarkdown(absolute));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolute);
  }
  return result;
}

function githubSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

function parseDocument(file, content) {
  const lines = content.split(/\r?\n/);
  const headings = new Map();
  const links = [];
  const h1Lines = [];
  const slugCounts = new Map();
  let fenced = false;

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (heading[1].length === 1) h1Lines.push(index + 1);
      const base = githubSlug(heading[2]);
      const duplicate = slugCounts.get(base) ?? 0;
      slugCounts.set(base, duplicate + 1);
      headings.set(duplicate === 0 ? base : `${base}-${duplicate}`, index + 1);
    }

    const linkPattern = /(?<!!)\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\)/g;
    for (const match of line.matchAll(linkPattern)) {
      const raw = match[1].replace(/^<|>$/g, '');
      links.push({ raw, line: index + 1 });
      if (/^https?:\/\//i.test(raw)) externalLinks.add(raw);
    }
  });

  return { file, content, lines, headings, links, h1Lines };
}

function splitTarget(raw) {
  const hashIndex = raw.indexOf('#');
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const fragment = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  return { target: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash, fragment };
}

async function exists(target) {
  try {
    return await stat(target);
  } catch {
    return null;
  }
}

function resolveInternal(sourceFile, raw) {
  const { target, fragment } = splitTarget(raw);
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return { error: `ungültige URL-Kodierung in „${raw}“` };
  }
  const targetFile = decoded ? path.resolve(path.dirname(sourceFile), decoded) : sourceFile;
  return { targetFile, fragment };
}

async function validateDocument(document) {
  if (document.h1Lines.length !== 1) {
    errors.push(`${location(document.file, document.h1Lines[0] ?? 1)} genau eine H1 erwartet, gefunden: ${document.h1Lines.length}`);
  }

  for (const link of document.links) {
    if (/^(https?:|mailto:|tel:)/i.test(link.raw)) continue;
    const resolved = resolveInternal(document.file, link.raw);
    if (resolved.error) {
      errors.push(`${location(document.file, link.line)} ${resolved.error}`);
      continue;
    }
    const targetStat = await exists(resolved.targetFile);
    if (!targetStat) {
      errors.push(`${location(document.file, link.line)} Linkziel fehlt: ${link.raw}`);
      continue;
    }
    if (!resolved.fragment) continue;

    if (resolved.targetFile.endsWith('.md')) {
      const targetDocument = documents.get(resolved.targetFile);
      if (!targetDocument?.headings.has(resolved.fragment)) {
        errors.push(`${location(document.file, link.line)} Überschriftenanker fehlt: ${link.raw}`);
      }
      continue;
    }

    const lineAnchor = resolved.fragment.match(/^L(\d+)$/);
    if (!lineAnchor) {
      errors.push(`${location(document.file, link.line)} ungültiger Quellcodeanker (erwartet #L<n>): ${link.raw}`);
      continue;
    }
    if (!targetStat.isFile()) {
      errors.push(`${location(document.file, link.line)} Zeilenanker zeigt nicht auf eine Datei: ${link.raw}`);
      continue;
    }
    const targetLines = (await readFile(resolved.targetFile, 'utf8')).split(/\r?\n/).length;
    if (Number(lineAnchor[1]) < 1 || Number(lineAnchor[1]) > targetLines) {
      errors.push(`${location(document.file, link.line)} Quellcodezeile existiert nicht (${targetLines} Zeilen): ${link.raw}`);
    }
  }
}

function linkedMarkdown(document) {
  const result = [];
  for (const link of document.links) {
    if (/^(https?:|mailto:|tel:)/i.test(link.raw)) continue;
    const resolved = resolveInternal(document.file, link.raw);
    if (!resolved.error && resolved.targetFile.endsWith('.md') && documents.has(resolved.targetFile)) result.push(resolved.targetFile);
  }
  return result;
}

async function validateIndex() {
  const indexFile = path.join(root, 'docs', 'README.md');
  const index = documents.get(indexFile);
  if (!index) {
    errors.push('docs/README.md:1 zentraler Dokumentationsindex fehlt');
    return;
  }

  const direct = new Set(linkedMarkdown(index));
  for (const file of documents.keys()) {
    if (!file.startsWith(`${path.join(root, 'docs')}${path.sep}`) || file === indexFile) continue;
    if (!direct.has(file)) errors.push(`docs/README.md:1 Seite nicht im zentralen Index aufgenommen: ${relative(file)}`);
  }

  const reachable = new Set([indexFile]);
  const queue = [indexFile];
  while (queue.length) {
    const current = queue.shift();
    for (const target of linkedMarkdown(documents.get(current))) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }
  for (const file of documents.keys()) {
    if (file.startsWith(`${path.join(root, 'docs')}${path.sep}`) && !reachable.has(file)) {
      errors.push(`docs/README.md:1 vom zentralen Index nicht erreichbar: ${relative(file)}`);
    }
  }
}

async function validateLegacyPages() {
  for (const [legacy, destination] of legacyPaths) {
    const file = path.join(root, legacy);
    const document = documents.get(file);
    if (!document) {
      errors.push(`${legacy}:1 festgelegter Legacy-Pfad fehlt`);
      continue;
    }
    if (!/verschoben/i.test(document.content)) errors.push(`${legacy}:1 Verschoben-Hinweis fehlt`);
    const expected = path.join(root, destination);
    if (!linkedMarkdown(document).includes(expected)) {
      errors.push(`${legacy}:1 Verschoben-Hinweis verlinkt nicht auf ${destination}`);
    }
  }
}

async function checkExternal(url) {
  const request = async (method) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'accura-docs-check/1.0' },
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let response = await request('HEAD');
    if (response.status === 405 || response.status === 501) response = await request('GET');
    if (!response.ok) errors.push(`extern: ${url} antwortet mit HTTP ${response.status}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`extern: ${url} nicht erreichbar (${reason})`);
  }
}

const markdownFiles = (await collectMarkdown(root)).sort();
for (const file of markdownFiles) {
  const content = await readFile(file, 'utf8');
  documents.set(file, parseDocument(file, content));
}
for (const document of documents.values()) await validateDocument(document);
await validateIndex();
await validateLegacyPages();

if (externalMode && errors.length === 0) {
  const urls = [...externalLinks].sort();
  process.stdout.write(`Prüfe ${urls.length} deduplizierte externe Links …\n`);
  for (let index = 0; index < urls.length; index += 4) {
    await Promise.all(urls.slice(index, index + 4).map(checkExternal));
  }
}

for (const warning of warnings) process.stderr.write(`Hinweis: ${warning}\n`);
if (errors.length) {
  for (const error of errors) process.stderr.write(`Fehler: ${error}\n`);
  process.stderr.write(`Dokumentationscheck fehlgeschlagen: ${errors.length} Fehler.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Dokumentationscheck erfolgreich: ${documents.size} Markdown-Dateien, ${externalLinks.size} externe Links${externalMode ? ' geprüft' : ' gefunden'}.\n`);
}
