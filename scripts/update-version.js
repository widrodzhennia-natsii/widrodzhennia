import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const pkgLockPath = path.join(rootDir, 'package-lock.json');
const resourcesDir = path.join(rootDir, 'src', 'resources');
const changelogPath = path.join(resourcesDir, 'changelog.json');
const versionInfoPath = path.join(resourcesDir, 'versionInfo.ts');

const bumpType = ['major', 'minor', 'patch'].includes(process.argv[2])
  ? process.argv[2]
  : 'patch';
const customTitle = process.argv[3];
const customChanges = process.argv.slice(4);

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const versionParts = pkg.version.split('.').map(Number);

  if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) {
    throw new Error(`Invalid semver version in package.json: "${pkg.version}"`);
  }

  if (bumpType === 'major') {
    versionParts[0] += 1;
    versionParts[1] = 0;
    versionParts[2] = 0;
  } else if (bumpType === 'minor') {
    versionParts[1] += 1;
    versionParts[2] = 0;
  } else {
    versionParts[2] += 1;
  }

  const newVersion = versionParts.join('.');

  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  if (fs.existsSync(pkgLockPath)) {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = newVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
      pkgLock.packages[''].version = newVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');
  }

  fs.mkdirSync(resourcesDir, { recursive: true });

  const changelog = fs.existsSync(changelogPath)
    ? JSON.parse(fs.readFileSync(changelogPath, 'utf8'))
    : [];
  const today = new Date().toISOString().split('T')[0];

  changelog.unshift({
    version: newVersion,
    date: today,
    title: customTitle || `Оновлення v${newVersion}`,
    changes:
      customChanges.length > 0
        ? customChanges
        : ['Планове оновлення версії та поліпшення платформи'],
  });

  fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n');

  const tsContent = `export interface VersionEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CURRENT_APP_VERSION = "${newVersion}";
export const LAST_UPDATED_DATE = "${today}";
`;
  fs.writeFileSync(versionInfoPath, tsContent);

  console.log(`[Version Auto-Bump] Updated to v${newVersion}`);
} catch (err) {
  console.error('Failed to bump version:', err);
  process.exit(1);
}

