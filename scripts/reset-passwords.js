require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

async function reset() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const clientHash = await bcrypt.hash('demo123', 10);

  await query(
    `INSERT INTO admins (username, password_hash, name)
     VALUES ('admin', ?, 'مدير النظام')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
    [adminHash]
  );

  for (const username of ['demo001', 'rikaz_admin']) {
    await query('UPDATE associations SET password_hash = ?, is_first_login = 1 WHERE username = ?', [
      clientHash,
      username,
    ]);
  }

  console.log('[OK] Passwords reset for: admin, demo001, rikaz_admin');
  await pool.end();
}

reset().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
