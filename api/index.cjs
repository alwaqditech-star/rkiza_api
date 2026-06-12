'use strict';

const express = require('express');

function loadApp() {
  try {
    const mod = require('./dist/server.js');
    const app = mod.default ?? mod.app;

    if (typeof app !== 'function') {
      throw new Error('Express app export missing from ./dist/server.js');
    }

    return app;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[API BOOT ERROR]', message);
    if (stack) console.error(stack);

    const fallback = express();
    fallback.use((_req, res) => {
      res.status(500).json({
        success: false,
        message: 'فشل تشغيل خادم API على Vercel',
        error: message,
        hint: 'تأكد من نجاح npm run build ونسخ dist إلى api/dist',
      });
    });
    return fallback;
  }
}

module.exports = loadApp();
