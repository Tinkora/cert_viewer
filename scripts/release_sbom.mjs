import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_PACKAGE_ID = 'SPDXRef-Package-Release';
const ARCHIVE_IDS = {
  web: 'SPDXRef-File-WebArchive',
  source: 'SPDXRef-File-SourceArchive',
};
const SPDX_LICENSE_IDS = new Set([
  '0BSD',
  'Apache-1.0',
  'Apache-1.1',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'CC0-1.0',
  'CDDL-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'NCSA',
  'OFL-1.1',
  'OpenSSL',
  'PostgreSQL',
  'Python-2.0',
  'Unlicense',
  'Unicode-3.0',
  'WTFPL',
  'Zlib',
]);
const SPDX_EXCEPTION_IDS = new Set([
  'Autoconf-exception-3.0',
  'Classpath-exception-2.0',
  'GCC-exception-3.1',
  'LLVM-exception',
  'OpenJDK-assembly-exception-1.0',
]);

function fail(message) {
  throw new Error(message);
}

function packageId(component) {
  const identity = [
    component.ecosystem,
    component.identity,
    component.name,
    component.version,
  ].join('\0');
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 24);
  return `SPDXRef-Package-${component.ecosystem}-${digest}`;
}

function cargoPurl(name, version) {
  return `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function npmPurl(name, version) {
  if (name.startsWith('@') && name.includes('/')) {
    const [scope, packageName] = name.split('/', 2);
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function normalizeLicense(license) {
  if (typeof license !== 'string' || license.trim().length === 0) {
    return 'NOASSERTION';
  }
  const candidate = license.trim();
  const slashParts = candidate.split(/\s*\/\s*/);
  if (slashParts.length > 1 && slashParts.every((part) => SPDX_LICENSE_IDS.has(part))) {
    return slashParts.join(' OR ');
  }
  return isSpdxExpression(candidate) ? candidate : 'NOASSERTION';
}

function isSpdxExpression(expression) {
  const tokens = [];
  let offset = 0;
  while (offset < expression.length) {
    if (/\s/.test(expression[offset])) {
      offset += 1;
      continue;
    }
    if (expression[offset] === '(' || expression[offset] === ')') {
      tokens.push(expression[offset]);
      offset += 1;
      continue;
    }
    const match = expression.slice(offset).match(/^[A-Za-z0-9][A-Za-z0-9.-]*/);
    if (!match) {
      return false;
    }
    tokens.push(match[0]);
    offset += match[0].length;
  }

  let index = 0;
  const peek = () => tokens[index];
  const consume = (expected) => {
    if (peek() !== expected) {
      return false;
    }
    index += 1;
    return true;
  };
  const parsePrimary = () => {
    if (consume('(')) {
      if (!parseOr() || !consume(')')) {
        return false;
      }
      return true;
    }
    const id = peek();
    if (!id || !SPDX_LICENSE_IDS.has(id)) {
      return false;
    }
    index += 1;
    return true;
  };
  const parseWith = () => {
    if (!parsePrimary()) {
      return false;
    }
    if (consume('WITH')) {
      const exception = peek();
      if (!exception || !SPDX_EXCEPTION_IDS.has(exception)) {
        return false;
      }
      index += 1;
    }
    return true;
  };
  const parseAnd = () => {
    if (!parseWith()) {
      return false;
    }
    while (consume('AND')) {
      if (!parseWith()) {
        return false;
      }
    }
    return true;
  };
  function parseOr() {
    if (!parseAnd()) {
      return false;
    }
    while (consume('OR')) {
      if (!parseAnd()) {
        return false;
      }
    }
    return true;
  }

  return parseOr() && index === tokens.length;
}

function sortedComponents(inventory) {
  return [...inventory.cargo, ...inventory.npm].sort((left, right) => {
    const leftKey = `${left.ecosystem}\0${left.identity}`;
    const rightKey = `${right.ecosystem}\0${right.identity}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function archiveFile(archive, id) {
  if (!archive || !archive.fileName || !archive.bytes) {
    fail('Archive records must include a fileName and bytes.');
  }
  return {
    fileName: archive.fileName,
    SPDXID: id,
    checksums: [
      {
        algorithm: 'SHA1',
        checksumValue: createHash('sha1').update(archive.bytes).digest('hex'),
      },
      {
        algorithm: 'SHA256',
        checksumValue: createHash('sha256').update(archive.bytes).digest('hex'),
      },
    ],
    licenseConcluded: 'NOASSERTION',
    licenseInfoInFiles: ['NOASSERTION'],
    copyrightText: 'NOASSERTION',
  };
}

export function buildSpdxDocument({
  version,
  repository,
  commit,
  created,
  inventory,
  archives,
}) {
  if (!version || !repository || !commit || !created) {
    fail('SBOM metadata is incomplete.');
  }
  if (!inventory || !Array.isArray(inventory.cargo) || !Array.isArray(inventory.npm)) {
    fail('SBOM inventory is incomplete.');
  }
  if (!Array.isArray(archives) || archives.length !== 2) {
    fail('SBOM generation requires exactly two archive records.');
  }

  const components = sortedComponents(inventory);
  const componentPackages = components.map((component) => ({
    SPDXID: packageId(component),
    name: component.name,
    versionInfo: component.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: normalizeLicense(component.license),
    licenseDeclared: normalizeLicense(component.license),
    externalRefs: [
      {
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: component.purl,
      },
    ],
  }));

  const rootPackage = {
    SPDXID: ROOT_PACKAGE_ID,
    name: 'cert_viewer',
    versionInfo: version,
    downloadLocation: `https://github.com/${repository}/releases/tag/v${version}`,
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: 'NOASSERTION',
  };
  const webArchive = archives.find((archive) => archive.fileName.includes('-web-v'));
  const sourceArchive = archives.find((archive) => archive.fileName.includes('-source-v'));
  if (!webArchive || !sourceArchive) {
    fail('SBOM archives must include web and source records.');
  }
  const files = [
    archiveFile(webArchive, ARCHIVE_IDS.web),
    archiveFile(sourceArchive, ARCHIVE_IDS.source),
  ];

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `cert_viewer v${version} release SBOM`,
    documentNamespace: `https://github.com/${repository}/releases/spdx/${commit}`,
    creationInfo: {
      created,
      creators: ['Organization: Tinkora'],
    },
    documentDescribes: [ROOT_PACKAGE_ID, ARCHIVE_IDS.web, ARCHIVE_IDS.source],
    packages: [rootPackage, ...componentPackages],
    files,
    relationships: componentPackages.map((component) => ({
      spdxElementId: ROOT_PACKAGE_ID,
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: component.SPDXID,
    })),
  };
}

function expectedPackageMap(inventory) {
  return new Map(sortedComponents(inventory).map((component) => [packageId(component), component]));
}

function expectedArchiveMap(archives) {
  return new Map(archives.map((archive) => [archive.fileName, archive]));
}

function checksumFor(bytes, algorithm) {
  return createHash(algorithm.toLowerCase()).update(bytes).digest('hex');
}

export function validateSpdxDocument(document, context) {
  const { version, repository, commit, inventory, archives } = context;
  if (document?.spdxVersion !== 'SPDX-2.3' || document.dataLicense !== 'CC0-1.0') {
    fail('SPDX document header is invalid.');
  }
  const expectedNamespace = `https://github.com/${repository}/releases/spdx/${commit}`;
  if (document.documentNamespace !== expectedNamespace) {
    fail('SPDX document namespace is invalid.');
  }
  if (!Array.isArray(document.packages)) {
    fail('SPDX package inventory is invalid.');
  }
  const root = document.packages.find((pkg) => pkg.SPDXID === ROOT_PACKAGE_ID);
  if (!root || root.name !== 'cert_viewer' || root.versionInfo !== version) {
    fail('SPDX release root package is invalid.');
  }

  const expectedPackages = expectedPackageMap(inventory);
  for (const [id, component] of expectedPackages) {
    const pkg = document.packages.find((candidate) => candidate.SPDXID === id);
    if (!pkg) {
      fail(`Missing package ${component.ecosystem}:${component.identity}.`);
    }
    if (
      pkg.name !== component.name ||
      pkg.versionInfo !== component.version ||
      pkg.externalRefs?.length !== 1 ||
      pkg.externalRefs[0].referenceCategory !== 'PACKAGE-MANAGER' ||
      pkg.externalRefs[0].referenceType !== 'purl' ||
      pkg.externalRefs[0].referenceLocator !== component.purl
    ) {
      fail(`Package metadata mismatch for ${component.ecosystem}:${component.identity}.`);
    }
  }
  if (document.packages.length !== expectedPackages.size + 1) {
    fail('SPDX package inventory count is invalid.');
  }

  const expectedRelationships = new Set(
    [...expectedPackages.keys()].map((id) => `${ROOT_PACKAGE_ID}|DEPENDS_ON|${id}`),
  );
  if (!Array.isArray(document.relationships)) {
    fail('SPDX dependency relationships are invalid.');
  }
  for (const relationship of document.relationships) {
    const key = `${relationship.spdxElementId}|${relationship.relationshipType}|${relationship.relatedSpdxElement}`;
    if (!expectedRelationships.delete(key)) {
      fail(`Unexpected or duplicate SPDX dependency relationship: ${key}.`);
    }
  }
  if (expectedRelationships.size > 0) {
    fail('Missing dependency relationship.');
  }
  if (document.relationships.length !== expectedPackages.size) {
    fail('SPDX dependency relationship count is invalid.');
  }

  const expectedArchives = expectedArchiveMap(archives);
  if (!Array.isArray(document.files) || document.files.length !== expectedArchives.size) {
    fail('SPDX archive file inventory count is invalid.');
  }
  for (const [fileName, archive] of expectedArchives) {
    const file = document.files.find((candidate) => candidate.fileName === fileName);
    if (!file) {
      fail(`Missing archive file record: ${fileName}.`);
    }
    const expectedId = fileName.includes('-web-v') ? ARCHIVE_IDS.web : ARCHIVE_IDS.source;
    if (file.SPDXID !== expectedId) {
      fail(`Unexpected SPDX archive identifier: ${fileName}.`);
    }
    if (!Array.isArray(file.checksums) || file.checksums.length !== 2) {
      fail(`Archive checksum inventory is invalid for ${fileName}.`);
    }
    const checksums = new Map(file.checksums.map((checksum) => [checksum.algorithm, checksum.checksumValue]));
    for (const algorithm of ['SHA1', 'SHA256']) {
      const expected = checksumFor(archive.bytes, algorithm);
      if (checksums.get(algorithm) !== expected) {
        fail(`Archive checksum mismatch for ${fileName} (${algorithm}).`);
      }
    }
    if (checksums.size !== 2) {
      fail(`Archive checksum inventory is invalid for ${fileName}.`);
    }
  }

  const expectedDescribes = [ROOT_PACKAGE_ID, ARCHIVE_IDS.web, ARCHIVE_IDS.source];
  if (JSON.stringify(document.documentDescribes) !== JSON.stringify(expectedDescribes)) {
    fail('SPDX documentDescribes is invalid.');
  }
  return true;
}

function cargoIdentity(packageInfo, workspaceRoot) {
  if (packageInfo.source) {
    return `cargo:${packageInfo.source}:${packageInfo.name}:${packageInfo.version}`;
  }
  const manifest = relative(workspaceRoot, packageInfo.manifest_path).split('\\').join('/');
  return `cargo:path:${manifest}:${packageInfo.name}:${packageInfo.version}`;
}

export function inventoryFromMetadata(cargoMetadata, packageLock) {
  const workspaceRoot = cargoMetadata.workspace_root;
  const cargo = cargoMetadata.packages.map((packageInfo) => ({
    ecosystem: 'cargo',
    identity: cargoIdentity(packageInfo, workspaceRoot),
    name: packageInfo.name,
    version: packageInfo.version,
    purl: cargoPurl(packageInfo.name, packageInfo.version),
    license: packageInfo.license,
  }));
  const npm = Object.entries(packageLock.packages ?? {}).map(([lockKey, packageInfo]) => {
    const name = packageInfo.name ?? (lockKey === ''
      ? packageLock.name
      : lockKey.split('node_modules/').at(-1));
    if (!name || !packageInfo.version) {
      fail(`package-lock entry is missing name or version: ${lockKey || '<root>'}`);
    }
    return {
      ecosystem: 'npm',
      identity: `npm:${lockKey || '.'}:${packageInfo.version}`,
      name,
      version: packageInfo.version,
      purl: npmPurl(name, packageInfo.version),
      license: packageInfo.license,
    };
  });
  return { cargo, npm };
}

function loadInventory(repoRoot) {
  const cargo = spawnSync(
    'cargo',
    ['metadata', '--locked', '--format-version', '1'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (cargo.status !== 0) {
    fail(`cargo metadata failed:\n${cargo.stderr}`);
  }
  const cargoMetadata = JSON.parse(cargo.stdout);
  const packageLock = JSON.parse(readFileSync(resolve(repoRoot, 'package-lock.json'), 'utf8'));
  return inventoryFromMetadata(cargoMetadata, packageLock);
}

function readArchives(repoRoot, webArchive, sourceArchive) {
  return [webArchive, sourceArchive].map((archivePath) => ({
    fileName: `./${basename(archivePath)}`,
    bytes: readFileSync(resolve(repoRoot, archivePath)),
  }));
}

function argumentMap(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || index + 1 >= argv.length) {
      fail(`Invalid argument: ${token}`);
    }
    args.set(token.slice(2), argv[index + 1]);
    index += 1;
  }
  return args;
}

function required(args, name) {
  const value = args.get(name);
  if (!value) {
    fail(`Missing required argument: --${name}`);
  }
  return value;
}

function cliContext(args, repoRoot) {
  const version = required(args, 'version');
  const repository = required(args, 'repository');
  const commit = required(args, 'commit');
  const webArchive = required(args, 'web-archive');
  const sourceArchive = required(args, 'source-archive');
  return {
    version,
    repository,
    commit,
    inventory: loadInventory(repoRoot),
    archives: readArchives(repoRoot, webArchive, sourceArchive),
  };
}

function main() {
  const [mode, ...rawArgs] = process.argv.slice(2);
  const args = argumentMap(rawArgs);
  const repoRoot = resolve(args.get('repo-root') ?? process.cwd());
  if (mode === 'generate') {
    const context = {
      ...cliContext(args, repoRoot),
      created: required(args, 'created'),
    };
    const document = buildSpdxDocument(context);
    validateSpdxDocument(document, context);
    writeFileSync(required(args, 'output'), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return;
  }
  if (mode === 'validate') {
    const context = cliContext(args, repoRoot);
    const document = JSON.parse(readFileSync(required(args, 'sbom'), 'utf8'));
    validateSpdxDocument(document, context);
    return;
  }
  fail('Usage: release_sbom.mjs <generate|validate> [options].');
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
