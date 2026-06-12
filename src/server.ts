import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { getDbTarget, getPool } from '@/lib/db';
import { registerApiRoutes } from '@/register-routes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const handlersRoot = path.join(__dirname, 'handlers');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

app.get('/', (_req, res) => {
  const db = getDbTarget();
  res.json({
    success: true,
    message: 'مرحباً بك في API نظام ركاز المحاسبي',
    database: db.database,
    host: db.host,
    health: '/api/health',
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await getPool().query('SELECT 1');
    const db = getDbTarget();
    res.json({
      success: true,
      message: 'الخادم وقاعدة البيانات يعملان بشكل صحيح',
      database: db.database,
      host: db.host,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    res.status(503).json({
      success: false,
      message: 'فشل الاتصال بقاعدة البيانات',
      error: message,
    });
  }
});

const routeCount = registerApiRoutes(app, handlersRoot);
console.log(`[OK] Registered ${routeCount} API route groups`);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    console.error('[API ERROR]', message);
    res.status(500).json({
      success: false,
      message: 'خطأ داخلي في الخادم',
      error: message,
    });
  },
);

app.listen(PORT, () => {
  const db = getDbTarget();
  console.log(`[OK] Rikaz API running on http://localhost:${PORT}`);
  console.log(`[OK] Database: ${db.database} @ ${db.host}`);
  console.log(`[OK] Health: http://localhost:${PORT}/api/health`);
});
