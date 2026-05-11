import fs from 'fs';
import path from 'path';

const versionFilePath = path.resolve('src/utils/version.js');
const now = new Date();
const startYear = 2026;
// Calcular meses desde Janeiro de 2026
const monthCount = (now.getFullYear() - startYear) * 12 + (now.getMonth() + 1);
const day = now.getDate();

let content = fs.readFileSync(versionFilePath, 'utf8');
const versionMatch = content.match(/APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/);

if (versionMatch) {
  let [_, x, y, z] = versionMatch.map(Number);
  
  if (x !== monthCount) {
    x = monthCount;
    y = day;
    z = 1;
  } else if (y !== day) {
    y = day;
    z = 1;
  } else {
    z += 1;
  }

  const newVersion = `${x}.${y}.${z}`;
  const newContent = content.replace(/APP_VERSION = ".*?"/, `APP_VERSION = "${newVersion}"`);
  fs.writeFileSync(versionFilePath, newContent);
  console.log(`Version updated to: ${newVersion}`);
} else {
  console.error("Could not find version string in src/utils/version.js");
}
