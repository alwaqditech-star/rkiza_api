import 'dotenv/config';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import {
  getDbConfigStatus,
  getDbTarget,
  testDbConnection,
} from './lib/db';
import { registerApiRoutes } from './register-routes';
import { ensureJwtSecretConfigured } from './lib/auth';

const PORT = Number(process.env.PORT ?? 3001);
const handlersRoot = path.join(__dirname, 'handlers');

export const app = express();

try {
  ensureJwtSecretConfigured();
} catch (error) {
  console.error('[AUTH CONFIG ERROR]', error instanceof Error ? error.message : error);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (
        allowed.includes(origin) ||
        origin === 'http://localhost:3000' ||
        /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
      ) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'), false);
  },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.raw({ type: 'multipart/form-data', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
app.use('/uploads', express.static(uploadsRoot));

function sendRootInfo(
  res: express.Response,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.status(statusCode).json(payload);
}

function buildRootPayload() {
  const config = getDbConfigStatus();
  return {
    success: config.configured,
    message: config.configured
      ? 'مرحباً بك في API نظام ركاز المحاسبي'
      : 'الخادم يعمل — إعدادات قاعدة البيانات غير مكتملة',
    database: config.database ?? null,
    host: config.host ?? null,
    health: '/api/health',
    missing_env: config.configured ? undefined : config.missing,
  };
}

app.get(['/', '/api'], (_req, res) => {
  sendRootInfo(res, 200, buildRootPayload());
});

app.get('/api/health', async (_req, res) => {
  const config = getDbConfigStatus();

  if (!config.configured) {
    res.status(503).json({
      success: false,
      message: 'إعدادات قاعدة البيانات غير مكتملة على Vercel',
      missing_env: config.missing,
      hint: 'أضف المتغيرات في Vercel → Settings → Environment Variables ثم أعد النشر',
    });
    return;
  }

  try {
    await testDbConnection();
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
      hint:
        'تأكد من تفعيل Remote MySQL في SmarterASP والسماح بالاتصال من أي IP (%)',
    });
  }
});

try {
  const routeCount = registerApiRoutes(app, handlersRoot);
  console.log(`[OK] Registered ${routeCount} API route groups`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'خطأ غير معروف';
  console.error('[ROUTE REGISTER ERROR]', message);
  app.all('/api/*', (_req, res) => {
    res.status(500).json({
      success: false,
      message: 'فشل تحميل مسارات API على الخادم',
      error: message,
    });
  });
}

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

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const config = getDbConfigStatus();
    console.log(`[OK] Rikaz API running on http://localhost:${PORT}`);
    if (config.configured) {
      console.log(`[OK] Database: ${config.database} @ ${config.host}`);
    } else {
      console.log('[WARN] Database env not configured');
    }
    console.log(`[OK] Health: http://localhost:${PORT}/api/health`);
  });
}
