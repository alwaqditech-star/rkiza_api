const { createRequire } = require('node:module');
const path = require('node:path');
const express = require('express');

const requireFromDist = createRequire(path.join(__dirname, '../dist/server.js'));

let app;

try {
  const mod = requireFromDist('./server.js');
  app = mod.default ?? mod.app;

  if (typeof app !== 'function') {
    throw new Error('تعذر تحميل تطبيق Express من dist/server.js');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[API BOOT ERROR]', message);

  app = express();
  app.use((_req, res) => {
    res.status(500).json({
      success: false,
      message: 'فشل تشغيل خادم API',
      error: message,
      hint: 'تأكد من نجاح npm run build ووجود مجلد dist على Vercel',
    });
  });
}

module.exports = app;
