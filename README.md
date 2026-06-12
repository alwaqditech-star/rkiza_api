# Rikaz API (`api_project`)

خادم API منفصل لنظام ركاز المحاسبي — Express + TypeScript.

## التشغيل

```bash
cd api_project
npm install
npm run dev
```

الخادم يعمل على: `http://localhost:3001`

## الإعداد

انسخ `.env` وعدّل بيانات الاتصال:

- `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `JWT_SECRET` (يجب أن يطابق `rikaz_project`)
- `PORT` (افتراضي: 3001)

## الربط مع الواجهة

مشروع `rikaz_project` يوجّه كل طلبات `/api/*` إلى هذا الخادم عبر `API_BASE_URL`.

```bash
# نافذة 1 — API
cd api_project && npm run dev

# نافذة 2 — الواجهة
cd rikaz_project && npm run dev
```

## الهيكل

```
api_project/
├── src/
│   ├── server.ts          # نقطة الدخول
│   ├── handlers/          # مسارات API (منقولة من Next.js)
│   ├── lib/               # الخدمات وقاعدة البيانات
│   └── adapters/          # ربط Express مع معالجات API
└── .env
```
