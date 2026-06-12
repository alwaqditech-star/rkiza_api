const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
  }

  const token = jwt.sign(
    { id: 0, username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.json({
    success: true,
    message: 'تم تسجيل الدخول بنجاح',
    data: { token, role: 'admin', username },
  });
});

module.exports = router;
