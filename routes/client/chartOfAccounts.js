const express = require('express');
const { query } = require('../../config/database');
const { authenticateToken, requireClient } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, requireClient, async (req, res) => {
  try {
    const accounts = await query(
      `SELECT id, account_code, account_name, account_name_en, account_type,
              account_nature, parent_code, allow_payment, notes
       FROM chart_of_accounts
       WHERE association_id = ?
       ORDER BY account_code`,
      [req.user.id]
    );

    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب دليل الحسابات', error: error.message });
  }
});

router.post('/', authenticateToken, requireClient, async (req, res) => {
  try {
    const {
      account_code,
      account_name,
      account_name_en,
      account_type,
      account_nature = 'dr',
      parent_code,
      allow_payment = 'No',
      notes,
    } = req.body;

    if (!account_code || !account_name || !account_type) {
      return res.status(400).json({ success: false, message: 'رمز الحساب واسمه ونوعه مطلوبة' });
    }

    const existing = await query(
      'SELECT id FROM chart_of_accounts WHERE association_id = ? AND account_code = ?',
      [req.user.id, account_code]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'رمز الحساب موجود مسبقاً' });
    }

    const result = await query(
      `INSERT INTO chart_of_accounts
       (association_id, account_code, account_name, account_name_en, account_type,
        account_nature, parent_code, allow_payment, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        account_code,
        account_name,
        account_name_en || null,
        account_type,
        account_nature,
        parent_code || null,
        allow_payment,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'تم إضافة الحساب بنجاح',
      data: { id: result.insertId, account_code, account_name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة الحساب', error: error.message });
  }
});

router.put('/:id', authenticateToken, requireClient, async (req, res) => {
  try {
    const {
      account_name,
      account_name_en,
      account_type,
      account_nature,
      parent_code,
      allow_payment,
      notes,
    } = req.body;

    const existing = await query(
      'SELECT id FROM chart_of_accounts WHERE id = ? AND association_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    }

    await query(
      `UPDATE chart_of_accounts SET
       account_name = COALESCE(?, account_name),
       account_name_en = COALESCE(?, account_name_en),
       account_type = COALESCE(?, account_type),
       account_nature = COALESCE(?, account_nature),
       parent_code = COALESCE(?, parent_code),
       allow_payment = COALESCE(?, allow_payment),
       notes = COALESCE(?, notes)
       WHERE id = ? AND association_id = ?`,
      [
        account_name,
        account_name_en,
        account_type,
        account_nature,
        parent_code,
        allow_payment,
        notes,
        req.params.id,
        req.user.id,
      ]
    );

    res.json({ success: true, message: 'تم تحديث الحساب بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث الحساب', error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireClient, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM chart_of_accounts WHERE id = ? AND association_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف الحساب بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف الحساب', error: error.message });
  }
});

module.exports = router;
