const express = require('express');
const { query } = require('../../config/database');
const { authenticateToken, requireClient } = require('../../middleware/auth');
const { calculateIndicators } = require('../../services/financialIndicators');

const router = express.Router();

const INPUT_FIELDS = [
  'total_expenses',
  'admin_expenses',
  'program_expenses',
  'activity_admin_expenses',
  'total_activity_expenses',
  'sustainability_returns',
  'sustainability_expenses',
  'sustainability_assets',
  'total_donations',
  'fundraising_expenses',
  'cash_equivalents',
  'net_restricted_assets',
  'net_endowment_cash',
  'current_liabilities',
  'net_current_cash_investments',
  'estimated_annual_admin_expenses',
];

router.get('/', authenticateToken, requireClient, async (req, res) => {
  try {
    const { fiscal_year } = req.query;
    let sql = 'SELECT * FROM safety_financial_inputs WHERE association_id = ?';
    const params = [req.user.id];

    if (fiscal_year) {
      sql += ' AND fiscal_year = ?';
      params.push(fiscal_year);
    }

    sql += ' ORDER BY fiscal_year DESC';

    const inputs = await query(sql, params);

    const withIndicators = inputs.map((input) => ({
      ...input,
      analysis: calculateIndicators(input),
    }));

    res.json({ success: true, data: withIndicators });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المؤشرات', error: error.message });
  }
});

router.get('/calculate', authenticateToken, requireClient, async (req, res) => {
  try {
    const { fiscal_year } = req.query;

    if (!fiscal_year) {
      return res.status(400).json({ success: false, message: 'السنة المالية مطلوبة' });
    }

    const rows = await query(
      'SELECT * FROM safety_financial_inputs WHERE association_id = ? AND fiscal_year = ?',
      [req.user.id, fiscal_year]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'لا توجد بيانات لهذه السنة المالية' });
    }

    const analysis = calculateIndicators(rows[0]);

    res.json({
      success: true,
      data: {
        fiscal_year: parseInt(fiscal_year, 10),
        inputs: rows[0],
        analysis,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حساب المؤشرات', error: error.message });
  }
});

router.post('/', authenticateToken, requireClient, async (req, res) => {
  try {
    const { fiscal_year, ...fields } = req.body;

    if (!fiscal_year) {
      return res.status(400).json({ success: false, message: 'السنة المالية مطلوبة' });
    }

    const existing = await query(
      'SELECT id FROM safety_financial_inputs WHERE association_id = ? AND fiscal_year = ?',
      [req.user.id, fiscal_year]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'بيانات هذه السنة المالية موجودة مسبقاً، استخدم التحديث',
      });
    }

    const columns = ['association_id', 'fiscal_year'];
    const values = [req.user.id, fiscal_year];
    const placeholders = ['?', '?'];

    INPUT_FIELDS.forEach((field) => {
      if (fields[field] !== undefined) {
        columns.push(field);
        values.push(fields[field]);
        placeholders.push('?');
      }
    });

    const result = await query(
      `INSERT INTO safety_financial_inputs (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    const inserted = await query('SELECT * FROM safety_financial_inputs WHERE id = ?', [result.insertId]);
    const analysis = calculateIndicators(inserted[0]);

    res.status(201).json({
      success: true,
      message: 'تم حفظ البيانات المالية بنجاح',
      data: { ...inserted[0], analysis },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حفظ البيانات', error: error.message });
  }
});

router.put('/:id', authenticateToken, requireClient, async (req, res) => {
  try {
    const existing = await query(
      'SELECT id FROM safety_financial_inputs WHERE id = ? AND association_id = ?',
      [req.params.id, req.user.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'البيانات غير موجودة' });
    }

    const updates = [];
    const params = [];

    INPUT_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    });

    if (req.body.fiscal_year !== undefined) {
      updates.push('fiscal_year = ?');
      params.push(req.body.fiscal_year);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }

    params.push(req.params.id, req.user.id);
    await query(
      `UPDATE safety_financial_inputs SET ${updates.join(', ')} WHERE id = ? AND association_id = ?`,
      params
    );

    const updated = await query('SELECT * FROM safety_financial_inputs WHERE id = ?', [req.params.id]);
    const analysis = calculateIndicators(updated[0]);

    res.json({
      success: true,
      message: 'تم تحديث البيانات المالية بنجاح',
      data: { ...updated[0], analysis },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث البيانات', error: error.message });
  }
});

module.exports = router;
