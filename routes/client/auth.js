const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');
const { authenticateToken, requireClient } = require('../../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const rows = await query(
      `SELECT id, association_name, username, password_hash, is_first_login,
              subscription_start, subscription_end, status
       FROM associations WHERE username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    const association = rows[0];

    if (association.status === 'expired') {
      return res.status(403).json({ success: false, message: 'انتهت صلاحية الاشتراك' });
    }

    const today = new Date();
    const endDate = new Date(association.subscription_end);
    if (today > endDate) {
      await query("UPDATE associations SET status = 'expired' WHERE id = ?", [association.id]);
      return res.status(403).json({ success: false, message: 'انتهت صلاحية الاشتراك' });
    }

    const validPassword = await bcrypt.compare(password, association.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign(
      {
        id: association.id,
        username: association.username,
        association_name: association.association_name,
        role: 'client',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        token,
        role: 'client',
        association_id: association.id,
        association_name: association.association_name,
        is_first_login: !!association.is_first_login,
        subscription_end: association.subscription_end,
        days_remaining: daysRemaining,
        subscription_alert: daysRemaining <= 60,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تسجيل الدخول', error: error.message });
  }
});

router.post('/change-password', authenticateToken, requireClient, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const rows = await query('SELECT password_hash FROM associations WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الجمعية غير موجودة' });
    }

    const validPassword = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await query(
      'UPDATE associations SET password_hash = ?, is_first_login = 0 WHERE id = ?',
      [password_hash, req.user.id]
    );

    res.json({ success: true, message: 'تم تحديث كلمة المرور بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث كلمة المرور', error: error.message });
  }
});

module.exports = router;
