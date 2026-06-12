import mysql, {
  Pool,
  PoolOptions,
  ResultSetHeader,
  RowDataPacket,
  type ExecuteValues,
} from 'mysql2/promise';

export type { ResultSetHeader, RowDataPacket };

const globalForDb = globalThis as unknown as {
  mysqlPool: Pool | undefined;
  mysqlPoolKey: string | undefined;
};

let pool: Pool | null = null;
let poolKey: string | null = null;

function useGlobalPool(): boolean {
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.VERCEL);
}

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getPoolConfigKey(config: PoolOptions): string {
  return `${config.host}:${config.port}/${config.database}:${config.user}`;
}

function buildSslConfig(): PoolOptions['ssl'] {
  const mode = readEnv('MYSQL_SSL')?.toLowerCase();
  if (mode === 'true' || mode === '1') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function getDbConfigStatus(): {
  configured: boolean;
  missing: string[];
  host?: string;
  database?: string;
} {
  const url = readEnv('DATABASE_URL');
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        configured: true,
        missing: [],
        host: parsed.hostname,
        database: parsed.pathname.replace(/^\//, ''),
      };
    } catch {
      return {
        configured: false,
        missing: ['DATABASE_URL (صيغة غير صالحة)'],
      };
    }
  }

  const host = readEnv('MYSQL_HOST', 'DB_HOST');
  const database = readEnv('MYSQL_DATABASE', 'DB_NAME', 'DB_DATABASE');
  const user = readEnv('MYSQL_USER', 'DB_USER');
  const password = readEnv('MYSQL_PASSWORD', 'DB_PASSWORD');

  const missing: string[] = [];
  if (!host) missing.push('MYSQL_HOST');
  if (!database) missing.push('MYSQL_DATABASE');
  if (!user) missing.push('MYSQL_USER');
  if (!password) missing.push('MYSQL_PASSWORD');

  return {
    configured: missing.length === 0,
    missing,
    host,
    database,
  };
}

function buildPoolConfig(): PoolOptions {
  const url = readEnv('DATABASE_URL');

  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? (process.env.VERCEL ? 2 : 5)),
      maxIdle: Number(process.env.DB_MAX_IDLE ?? 1),
      idleTimeout: Number(process.env.DB_IDLE_TIMEOUT ?? 60_000),
      queueLimit: 0,
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 15_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4_unicode_ci',
      ssl: buildSslConfig(),
    };
  }

  const host = readEnv('MYSQL_HOST', 'DB_HOST');
  const database = readEnv('MYSQL_DATABASE', 'DB_NAME', 'DB_DATABASE');

  if (!host || !database) {
    const status = getDbConfigStatus();
    throw new Error(
      `إعدادات قاعدة البيانات غير مكتملة — أضف في Vercel: ${status.missing.join(', ')}`,
    );
  }

  return {
    host,
    port: Number(readEnv('MYSQL_PORT', 'DB_PORT') ?? 3306),
    user: readEnv('MYSQL_USER', 'DB_USER') ?? '',
    password: readEnv('MYSQL_PASSWORD', 'DB_PASSWORD') ?? '',
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? (process.env.VERCEL ? 2 : 5)),
    maxIdle: Number(process.env.DB_MAX_IDLE ?? 1),
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT ?? 60_000),
    queueLimit: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT ?? 15_000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4_unicode_ci',
    ssl: buildSslConfig(),
  };
}

export function getDbTarget(): { host: string; database: string } {
  const status = getDbConfigStatus();
  if (!status.configured) {
    throw new Error(
      `إعدادات قاعدة البيانات غير مكتملة — أضف في Vercel: ${status.missing.join(', ')}`,
    );
  }

  const config = buildPoolConfig();
  return {
    host: String(config.host ?? ''),
    database: String(config.database ?? ''),
  };
}

export function getPool(): Pool {
  const config = buildPoolConfig();
  const nextKey = getPoolConfigKey(config);

  if (useGlobalPool()) {
    if (globalForDb.mysqlPool && globalForDb.mysqlPoolKey !== nextKey) {
      void globalForDb.mysqlPool.end();
      globalForDb.mysqlPool = undefined;
      globalForDb.mysqlPoolKey = undefined;
    }
    if (!globalForDb.mysqlPool) {
      globalForDb.mysqlPool = mysql.createPool(config);
      globalForDb.mysqlPoolKey = nextKey;
    }
    return globalForDb.mysqlPool;
  }

  if (pool && poolKey !== nextKey) {
    void pool.end();
    pool = null;
    poolKey = null;
  }
  if (!pool) {
    pool = mysql.createPool(config);
    poolKey = nextKey;
  }
  return pool;
}

export type SqlParams = ExecuteValues | readonly unknown[];

export async function query<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = [],
): Promise<T> {
  const [rows] = await getPool().query<T>(sql, params as ExecuteValues);
  return rows;
}

export async function execute(
  sql: string,
  params: SqlParams = [],
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(
    sql,
    params as ExecuteValues,
  );
  return result;
}

export async function getConnection() {
  return getPool().getConnection();
}

export async function testDbConnection(): Promise<void> {
  await getPool().query('SELECT 1');
}
