const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');

const packageJson = require(packageJsonPath);
const manifestJson = require(manifestJsonPath);

if (manifestJson.version !== packageJson.version) {
    console.log(`Syncing manifest.json version from ${manifestJson.version} to ${packageJson.version}...`);
    manifestJson.version = packageJson.version;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, '\t') + '\n');
    console.log('Updated manifest.json');
} else {
    console.log('manifest.json version is already up to date.');
}
