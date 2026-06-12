'use strict';

const fs = require('node:fs');
const path = require('node:path');

const srcRoot = path.join(__dirname, '..', 'src');
const aliasPattern =
  /(?:from\s+['"]@\/([^'"]+)['"]|require\(['"]@\/([^'"]+)['"]\))/g;

function toRelative(fromFile, aliasPath) {
  const fromDir = path.dirname(fromFile);
  const targetBase = path.join(srcRoot, aliasPath);
  let rel = path.relative(fromDir, targetBase).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const next = content.replace(aliasPattern, (match, fromPath, requirePath) => {
    const aliasPath = fromPath ?? requirePath;
    const rel = toRelative(filePath, aliasPath);

    changed = true;
    if (match.startsWith('require')) {
      return `require('${rel}')`;
    }
    const quote = match.includes('"') ? '"' : "'";
    return `from ${quote}${rel}${quote}`;
  });

  const nextServerPattern = /from\s+(['"])next\/server\1/g;
  const nextServerConverted = next.replace(nextServerPattern, (_m, quote) => {
    const rel = toRelative(filePath, 'shims/next-server');
    changed = true;
    return `from ${quote}${rel}${quote}`;
  });

  if (changed) {
    fs.writeFileSync(filePath, nextServerConverted, 'utf8');
  }

  return changed;
}

function walk(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += walk(full);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    if (convertFile(full)) count += 1;
  }
  return count;
}

const updated = walk(srcRoot);
console.log(`[OK] Converted @/ imports in ${updated} file(s)`);
