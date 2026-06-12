'use strict';

const path = require('node:path');
const express = require('express');

function loadApp() {
  const distPath = path.join(__dirname, 'dist', 'server.js');

  try {
    const mod = require(distPath);
    const app = mod.default ?? mod.app;

    if (typeof app !== 'function') {
      throw new Error('Express app export missing from api/dist/server.js');
    }

    console.log('[OK] Loaded Express app from', distPath);
    return app;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[API BOOT ERROR]', message);
    if (stack) console.error(stack);

    const fallback = express();
    fallback.all('*', (_req, res) => {
      res.status(500).json({
        success: false,
        message: 'فشل تشغيل خادم API على Vercel',
        error: message,
        distPath,
        hint: 'تأكد أن api/dist موجود بعد npm run build',
      });
    });
    return fallback;
  }
}

module.exports = loadApp();
