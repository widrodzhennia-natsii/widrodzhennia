import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'src', 'resources', 'changelog.json');
const versionInfoPath = path.join(rootDir, 'src', 'resources', 'versionInfo.ts');

try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const versionParts = pkg.version.split('.').map(Number);
  versionParts[2] += 1;
  const newVersion = versionParts.join('.');
  
  pkg.version = newVersion;
  fs.readFileSync && fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const today = new Date().toISOString().split('T')[0];

  changelog.unshift({
    version: newVersion,
    date: today,
    title: `Патч оновлення v${newVersion}`,
    changes: ["Автоматичне оновлення версії та балансу завдань"]
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
  console.error("Failed to bump version:", err);
}
