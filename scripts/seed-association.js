require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

async function seed() {
  const password = 'rikaz123';
  const password_hash = await bcrypt.hash(password, 10);

  const existing = await query('SELECT id FROM associations WHERE username = ?', ['rikaz_admin']);

  if (existing.length > 0) {
    await query(
      `UPDATE associations SET
       association_name = ?, password_hash = ?, is_first_login = 1,
       subscription_start = CURRENT_DATE(),
       subscription_end = DATE_ADD(CURRENT_DATE(), INTERVAL 1 YEAR),
       status = 'active'
       WHERE username = ?`,
      ['جمعية ركاز الخيرية النموذجية', password_hash, 'rikaz_admin']
    );
    console.log('تم تحديث الجمعية: rikaz_admin');
  } else {
    await query(
      `INSERT INTO associations
       (association_name, username, password_hash, is_first_login, subscription_start, subscription_end, status)
       VALUES (?, ?, ?, 1, CURRENT_DATE(), DATE_ADD(CURRENT_DATE(), INTERVAL 1 YEAR), 'active')`,
      ['جمعية ركاز الخيرية النموذجية', 'rikaz_admin', password_hash]
    );
    console.log('تم إنشاء الجمعية: rikaz_admin');
  }

  console.log('تمت العملية بنجاح — username: rikaz_admin');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
