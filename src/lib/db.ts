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

function getPoolConfigKey(config: PoolOptions): string {
  return `${config.host}:${config.port}/${config.database}:${config.user}`;
}

function buildPoolConfig(): PoolOptions {
  const url = process.env.DATABASE_URL;

  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
      maxIdle: Number(process.env.DB_MAX_IDLE ?? 2),
      idleTimeout: Number(process.env.DB_IDLE_TIMEOUT ?? 60_000),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4_unicode_ci',
    };
  }

  const host = process.env.MYSQL_HOST;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !database) {
    throw new Error(
      'إعدادات قاعدة البيانات غير مكتملة — عيّن MYSQL_HOST و MYSQL_DATABASE في .env.local',
    );
  }

  return {
    host,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? '',
    password: process.env.MYSQL_PASSWORD ?? '',
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 5),
    maxIdle: Number(process.env.DB_MAX_IDLE ?? 2),
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT ?? 60_000),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4_unicode_ci',
  };
}

export function getDbTarget(): { host: string; database: string } {
  const config = buildPoolConfig();
  return {
    host: String(config.host ?? ''),
    database: String(config.database ?? ''),
  };
}

export function getPool(): Pool {
  const config = buildPoolConfig();
  const nextKey = getPoolConfigKey(config);

  if (process.env.NODE_ENV !== 'production') {
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
