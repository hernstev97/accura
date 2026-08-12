import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertCheckedInNotices, generateThirdPartyNotices } from './generate-third-party-notices.mjs';

const basePolicy = { allowedLicenses: ['ISC', 'MIT'], maxOutputBytes: 262144, packages: {} };

async function fixture(packages, policy = basePolicy) {
  const root = await mkdtemp(join(tmpdir(), 'accura-license-test-'));
  const lockData = { lockfileVersion: 3, packages: { '': { name: 'fixture', version: '1.0.0' } } };
  const dependencies = {};
  for (const packageEntry of packages) {
    const packagePath = join(root, 'node_modules', packageEntry.name);
    await mkdir(packagePath, { recursive: true });
    await writeFile(join(packagePath, 'package.json'), `${JSON.stringify({
      homepage: packageEntry.homepage,
      license: packageEntry.license,
      name: packageEntry.name,
      repository: packageEntry.repository,
      version: packageEntry.version,
    }, null, 2)}\n`);
    for (const [fileName, contents] of Object.entries(packageEntry.files ?? {})) {
      await writeFile(join(packagePath, fileName), contents);
    }
    const lockPath = `node_modules/${packageEntry.name}`;
    lockData.packages[lockPath] = { license: packageEntry.lockLicense ?? packageEntry.license, version: packageEntry.lockVersion ?? packageEntry.version };
    dependencies[packageEntry.name] = { name: packageEntry.name, path: packagePath, version: packageEntry.version };
  }
  return {
    dependencyTree: { dependencies },
    generate: () => generateThirdPartyNotices({ dependencyTree: { dependencies }, lockData, policy, projectRoot: root }),
    lockData,
    root,
  };
}

function validPackage(overrides = {}) {
  return {
    files: { LICENSE: 'Copyright Example\n\nPermission text stays unchanged.\n' },
    license: 'MIT',
    name: 'example',
    version: '1.0.0',
    ...overrides,
  };
}

test('fails closed when the license field is missing', async () => {
  const setup = await fixture([validPackage({ license: undefined })]);
  await assert.rejects(setup.generate, /keine Lizenzangabe/);
});

test('fails closed for unknown and syntactically invalid SPDX identifiers', async () => {
  const unknown = await fixture([validPackage({ license: 'Mystery-1.0' })]);
  await assert.rejects(unknown.generate, /unbekannte oder nicht freigegebene Lizenz/);
  const invalid = await fixture([validPackage({ license: 'MIT ??? ISC' })]);
  await assert.rejects(invalid.generate, /Ungültiger SPDX-Ausdruck/);
});

test('fails closed when no license text can be resolved', async () => {
  const setup = await fixture([validPackage({ files: {} })]);
  await assert.rejects(setup.generate, /kein mitgelieferter.*Lizenztext/);
});

test('fails closed when an explicitly required NOTICE is missing', async () => {
  const setup = await fixture(
    [validPackage()],
    { ...basePolicy, packages: { 'example@1.0.0': { requiredNoticeFiles: ['NOTICE'] } } },
  );
  await assert.rejects(setup.generate, /fehlt der erforderliche NOTICE-Text/);
});

test('fails closed for a composite license without a package-specific policy', async () => {
  const setup = await fixture([validPackage({ license: 'MIT AND ISC' })]);
  await assert.rejects(setup.generate, /nicht ausdrücklich freigegebenen Mehrfachlizenzausdruck/);
});

test('fails closed when package-lock.json and node_modules differ', async () => {
  const setup = await fixture([validPackage({ lockVersion: '2.0.0' })]);
  await assert.rejects(setup.generate, /package-lock\.json und Installation stimmen/);
});

test('enforces the byte budget without truncation', async () => {
  const setup = await fixture([validPackage()], { ...basePolicy, maxOutputBytes: 32 });
  await assert.rejects(setup.generate, /überschreitet das Limit/);
});

test('detects a stale checked-in notice byte-for-byte', async () => {
  const setup = await fixture([validPackage()]);
  const generated = await setup.generate();
  const checkedInPath = join(setup.root, 'THIRD_PARTY_NOTICES.txt');
  await writeFile(checkedInPath, Buffer.concat([generated, Buffer.from('stale')]));
  await assert.rejects(() => assertCheckedInNotices(checkedInPath, generated), /ist veraltet/);
});

test('sorts deterministically, groups identical texts, and preserves their bytes', async () => {
  const licenseText = 'Copyright Shared\n\nExact permission text.\n';
  const setup = await fixture([
    validPackage({ files: { LICENSE: licenseText }, name: 'zeta' }),
    validPackage({ files: { COPYING: licenseText }, name: 'alpha' }),
  ]);
  const first = await setup.generate();
  const second = await setup.generate();
  assert.deepEqual(first, second);
  const rendered = first.toString('utf8');
  assert.ok(rendered.indexOf('alpha@1.0.0') < rendered.indexOf('zeta@1.0.0'));
  assert.match(rendered, /Applies to: alpha@1\.0\.0, zeta@1\.0\.0/);
  assert.equal(rendered.split(licenseText).length - 1, 1);
  assert.equal((await readFile(join(setup.root, 'node_modules/alpha/COPYING'), 'utf8')), licenseText);
});
