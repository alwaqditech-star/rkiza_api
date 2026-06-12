import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { execute, getPool } from '../src/lib/db';

async function main() {
  const username = (process.argv[2] ?? 'osama').trim();
  const password = process.argv[3] ?? 'osama123';
  const name = process.argv[4] ?? 'أسامة';

  if (!username || !password) {
    throw new Error('Usage: npx tsx scripts/add-admin.ts <username> <password> [name]');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await execute(
    `INSERT INTO admins (username, password_hash, name)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
    [username, passwordHash, name],
  );

  console.log(`[OK] Admin "${username}" is ready`);
  await getPool().end();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[ERROR]', message);
  process.exit(1);
});
