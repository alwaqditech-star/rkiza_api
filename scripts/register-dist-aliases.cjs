'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function registerDistAliases(distRoot) {
  if (!fs.existsSync(distRoot)) {
    throw new Error(`dist folder not found: ${distRoot}`);
  }

  const distShim = path.join(distRoot, 'shims', 'next-server.js');
  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function patchedResolve(
    request,
    parent,
    isMain,
    options,
  ) {
    if (request.startsWith('@/')) {
      const target = path.join(distRoot, request.slice(2));
      return originalResolve.call(this, target, parent, isMain, options);
    }

    if (request === 'next/server') {
      return originalResolve.call(this, distShim, parent, isMain, options);
    }

    return originalResolve.call(this, request, parent, isMain, options);
  };
}

module.exports = { registerDistAliases };
