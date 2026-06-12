const express = require('express');

let app;

try {
  app = require('../dist/server').default;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[API BOOT ERROR]', message);
  app = express();
  app.use((_req, res) => {
    res.status(500).json({
      success: false,
      message: 'فشل تشغيل خادم API',
      error: message,
    });
  });
}

module.exports = app;
