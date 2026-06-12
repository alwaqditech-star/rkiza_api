'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.join(__dirname, '..', 'api', 'dist');

function walk(directory) {
  const issues = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      issues.push(...walk(fullPath));
      continue;
    }

    if (!entry.name.endsWith('.js')) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes('@/')) {
      issues.push(fullPath);
    }
  }

  return issues;
}

if (!fs.existsSync(targetDir)) {
  console.error('[ERROR] api/dist not found — run npm run build first');
  process.exit(1);
}

const unresolved = walk(targetDir);

if (unresolved.length > 0) {
  console.error('[ERROR] Unresolved @/ aliases found in build output:');
  for (const file of unresolved) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log('[OK] No unresolved @/ aliases in api/dist');
