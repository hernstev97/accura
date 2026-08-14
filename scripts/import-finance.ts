import { readFile } from 'node:fs/promises';
import { closeDatabase } from '../api/_lib/database.ts';
import { financeImportFingerprint, parseFinanceImportJson, parseFinanceImportSource } from '../api/_lib/financeImport.ts';
import { getFinanceRepository } from '../api/_lib/financeRepository.ts';
import { anonymousSheetsResponse } from '../src/mocks/anonymousWorkbook.ts';

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
const databaseUrl = requiredEnv('DATABASE_URL');

const raw = source.fromFixture
  ? anonymousSheetsResponse
  : parseFinanceImportJson(await readFile(source.fromFile!, 'utf8'));
const parsed = parseFinanceImportSource(raw);
if (!parsed.success) {
  const issueCount = parsed.issues.length;
  throw new Error(`Import validation failed with ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}.`);
}

try {
  const repository = getFinanceRepository(databaseUrl);
  const stored = await repository.replaceForSoleOwner(parsed.data);
  const expected = financeImportFingerprint(parsed.data);
  const actual = financeImportFingerprint(stored);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error('Imported finance stand failed the count and date parity check.');
  }

  process.stdout.write(`Imported finance stand for the verified owner. ${JSON.stringify(actual)}\n`);
} finally {
  await closeDatabase(databaseUrl);
}
