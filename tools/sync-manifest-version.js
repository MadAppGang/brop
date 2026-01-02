import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '../package.json');
const manifestJsonPath = join(__dirname, '../manifest.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const manifestJson = JSON.parse(readFileSync(manifestJsonPath, 'utf8'));

if (manifestJson.version !== packageJson.version) {
    console.log(`Syncing manifest.json version from ${manifestJson.version} to ${packageJson.version}...`);
    manifestJson.version = packageJson.version;
    writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, '\t') + '\n');
    console.log('Updated manifest.json');
} else {
    console.log('manifest.json version is already up to date.');
}
