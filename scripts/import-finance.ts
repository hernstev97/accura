import { readFile } from 'node:fs/promises';
import { financeImportFingerprint, parseFinanceImportSource } from '../api/_lib/financeImport.js';
import { getFinanceRepository } from '../api/_lib/financeRepository.js';
import { anonymousSheetsResponse } from '../src/mocks/anonymousWorkbook.js';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseArgs(argv: string[]) {
  let fromFixture = false;
  let fromFile: string | null = null;
  for (const argument of argv) {
    if (argument === '--from-fixture') fromFixture = true;
    else if (argument.startsWith('--from-file=')) fromFile = argument.slice('--from-file='.length);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (fromFixture === Boolean(fromFile)) {
    throw new Error('Provide exactly one of --from-fixture or --from-file=<path>.');
  }
  return { fromFixture, fromFile };
}

const source = parseArgs(process.argv.slice(2));
const googleSub = requiredEnv('GOOGLE_SUB');
const databaseUrl = requiredEnv('DATABASE_URL');
const raw = source.fromFixture
  ? anonymousSheetsResponse
  : JSON.parse(await readFile(source.fromFile!, 'utf8')) as unknown;
const parsed = parseFinanceImportSource(raw);
if (!parsed.success) {
  const issueCount = parsed.issues.length;
  throw new Error(`Import validation failed with ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}.`);
}

const repository = getFinanceRepository(databaseUrl);
const stored = await repository.replaceForGoogleSub(googleSub, parsed.data);
const expected = financeImportFingerprint(parsed.data);
const actual = financeImportFingerprint(stored);
if (JSON.stringify(expected) !== JSON.stringify(actual)) {
  throw new Error('Imported finance stand failed the count and date parity check.');
}

process.stdout.write(`Imported finance stand for owner mapping. ${JSON.stringify(actual)}\n`);
