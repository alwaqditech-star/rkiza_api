const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

function getSubscriptionDaysRemaining(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const associations = await query(
      `SELECT id, association_name, username, is_first_login,
              subscription_start, subscription_end, status, created_at
       FROM associations ORDER BY created_at DESC`
    );

    const enriched = associations.map((assoc) => {
      const daysRemaining = getSubscriptionDaysRemaining(assoc.subscription_end);
      return {
        ...assoc,
        days_remaining: daysRemaining,
        subscription_alert: daysRemaining <= 60,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الجمعيات', error: error.message });
  }
});

router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, association_name, username, is_first_login,
              subscription_start, subscription_end, status, created_at
       FROM associations WHERE id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الجمعية غير موجودة' });
    }

    const assoc = rows[0];
    const daysRemaining = getSubscriptionDaysRemaining(assoc.subscription_end);

    res.json({
      success: true,
      data: { ...assoc, days_remaining: daysRemaining, subscription_alert: daysRemaining <= 60 },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات الجمعية', error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      association_name,
      username,
      password,
      subscription_start,
      subscription_end,
      status = 'active',
    } = req.body;

    if (!association_name || !username || !password || !subscription_start || !subscription_end) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب تعبئتها' });
    }

    const existing = await query('SELECT id FROM associations WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'اسم المستخدم مستخدم مسبقاً' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO associations
       (association_name, username, password_hash, subscription_start, subscription_end, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [association_name, username, password_hash, subscription_start, subscription_end, status]
    );

    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب الجمعية بنجاح',
      data: { id: result.insertId, association_name, username },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إنشاء الجمعية', error: error.message });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      association_name,
      username,
      password,
      subscription_start,
      subscription_end,
      status,
    } = req.body;

    const existing = await query('SELECT id FROM associations WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'الجمعية غير موجودة' });
    }

    const updates = [];
    const params = [];

    if (association_name) {
      updates.push('association_name = ?');
      params.push(association_name);
    }
    if (username) {
      updates.push('username = ?');
      params.push(username);
    }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(password_hash);
    }
    if (subscription_start) {
      updates.push('subscription_start = ?');
      params.push(subscription_start);
    }
    if (subscription_end) {
      updates.push('subscription_end = ?');
      params.push(subscription_end);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }

    params.push(req.params.id);
    await query(`UPDATE associations SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'تم تحديث بيانات الجمعية بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث الجمعية', error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM associations WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'الجمعية غير موجودة' });
    }
    res.json({ success: true, message: 'تم حذف الجمعية بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف الجمعية', error: error.message });
  }
});

router.post('/:id/renew', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, subscription_end FROM associations WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الجمعية غير موجودة' });
    }

    const currentEnd = new Date(rows[0].subscription_end);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const baseDate = currentEnd > today ? currentEnd : today;
    baseDate.setFullYear(baseDate.getFullYear() + 1);
    const newEnd = baseDate.toISOString().slice(0, 10);

    await query(
      "UPDATE associations SET subscription_end = ?, status = 'active' WHERE id = ?",
      [newEnd, req.params.id]
    );

    res.json({
      success: true,
      message: 'تم تجديد الاشتراك لمدة سنة إضافية',
      data: { subscription_end: newEnd, status: 'active' },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تجديد الاشتراك', error: error.message });
  }
});

router.get('/:id/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [vouchers, accounts, indicators] = await Promise.all([
      query(
        `SELECT voucher_type, COUNT(*) as count, SUM(total_amount) as total
         FROM financial_vouchers WHERE association_id = ? GROUP BY voucher_type`,
        [req.params.id]
      ),
      query('SELECT COUNT(*) as count FROM chart_of_accounts WHERE association_id = ?', [req.params.id]),
      query(
        'SELECT fiscal_year, total_expenses FROM safety_financial_inputs WHERE association_id = ? ORDER BY fiscal_year DESC',
        [req.params.id]
      ),
    ]);

    res.json({
      success: true,
      data: { vouchers, accounts_count: accounts[0].count, financial_years: indicators },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب إحصائيات الجمعية', error: error.message });
  }
});

module.exports = router;
