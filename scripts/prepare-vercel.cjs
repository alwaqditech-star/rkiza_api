const fs = require('node:fs');
const path = require('node:path');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(sourcePath, destPath);
      continue;
    }

    fs.copyFileSync(sourcePath, destPath);
  }
}

const root = path.join(__dirname, '..');
const sourceDist = path.join(root, 'dist');
const targetDist = path.join(root, 'api', 'dist');

if (!fs.existsSync(sourceDist)) {
  console.error('[ERROR] dist/ not found — run tsc before prepare-vercel');
  process.exit(1);
}

if (fs.existsSync(targetDist)) {
  fs.rmSync(targetDist, { recursive: true, force: true });
}

copyRecursive(sourceDist, targetDist);

const { execSync } = require('node:child_process');
execSync('npx tsc-alias -p tsconfig.json --dir api/dist', {
  cwd: root,
  stdio: 'inherit',
});

const handlerCount = fs
  .readdirSync(path.join(targetDist, 'handlers'), { recursive: true })
  .filter((f) => String(f).endsWith('route.js')).length;

console.log(`[OK] Copied dist → api/dist (${handlerCount} route handlers)`);
