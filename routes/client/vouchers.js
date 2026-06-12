const express = require('express');
const { pool, query } = require('../../config/database');
const { authenticateToken, requireClient } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, requireClient, async (req, res) => {
  try {
    const { type, from, to } = req.query;
    let sql = `
      SELECT fv.*, 
        (SELECT COUNT(*) FROM journal_entries je WHERE je.voucher_id = fv.id) as entries_count
      FROM financial_vouchers fv
      WHERE fv.association_id = ?
    `;
    const params = [req.user.id];

    if (type) {
      sql += ' AND fv.voucher_type = ?';
      params.push(type);
    }
    if (from) {
      sql += ' AND fv.voucher_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND fv.voucher_date <= ?';
      params.push(to);
    }

    sql += ' ORDER BY fv.voucher_date DESC, fv.id DESC';

    const vouchers = await query(sql, params);
    res.json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السندات', error: error.message });
  }
});

router.get('/:id', authenticateToken, requireClient, async (req, res) => {
  try {
    const vouchers = await query(
      'SELECT * FROM financial_vouchers WHERE id = ? AND association_id = ?',
      [req.params.id, req.user.id]
    );

    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: 'السند غير موجود' });
    }

    const entries = await query(
      `SELECT je.*, coa.account_name
       FROM journal_entries je
       LEFT JOIN chart_of_accounts coa
         ON coa.account_code = je.account_code AND coa.association_id = ?
       WHERE je.voucher_id = ?`,
      [req.user.id, req.params.id]
    );

    res.json({ success: true, data: { ...vouchers[0], journal_entries: entries } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السند', error: error.message });
  }
});

router.post('/', authenticateToken, requireClient, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      voucher_type,
      voucher_number,
      voucher_date,
      beneficiary_name,
      description,
      journal_entries,
    } = req.body;

    if (!voucher_type || !voucher_number || !voucher_date || !beneficiary_name || !journal_entries?.length) {
      return res.status(400).json({
        success: false,
        message: 'بيانات السند والقيود اليومية مطلوبة',
      });
    }

    const totalDebit = journal_entries.reduce((sum, e) => sum + parseFloat(e.debit_amount || 0), 0);
    const totalCredit = journal_entries.reduce((sum, e) => sum + parseFloat(e.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'القيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن',
        details: { total_debit: totalDebit, total_credit: totalCredit },
      });
    }

    await connection.beginTransaction();

    const [voucherResult] = await connection.execute(
      `INSERT INTO financial_vouchers
       (association_id, voucher_type, voucher_number, voucher_date, total_amount, beneficiary_name, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        voucher_type,
        voucher_number,
        voucher_date,
        totalDebit,
        beneficiary_name,
        description || null,
      ]
    );

    const voucherId = voucherResult.insertId;

    for (const entry of journal_entries) {
      await connection.execute(
        `INSERT INTO journal_entries (voucher_id, account_code, debit_amount, credit_amount)
         VALUES (?, ?, ?, ?)`,
        [
          voucherId,
          entry.account_code,
          entry.debit_amount || 0,
          entry.credit_amount || 0,
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء السند بنجاح',
      data: { id: voucherId, voucher_number, total_amount: totalDebit },
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'خطأ في إنشاء السند', error: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/:id', authenticateToken, requireClient, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const vouchers = await query(
      'SELECT id FROM financial_vouchers WHERE id = ? AND association_id = ?',
      [req.params.id, req.user.id]
    );

    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: 'السند غير موجود' });
    }

    await connection.beginTransaction();
    await connection.execute('DELETE FROM journal_entries WHERE voucher_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM financial_vouchers WHERE id = ?', [req.params.id]);
    await connection.commit();

    res.json({ success: true, message: 'تم حذف السند بنجاح' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'خطأ في حذف السند', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
