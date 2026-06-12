const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'رمز المصادقة مطلوب' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'رمز المصادقة غير صالح أو منتهي' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'صلاحية المدير مطلوبة' });
  }
  next();
}

function requireClient(req, res, next) {
  if (req.user?.role !== 'client') {
    return res.status(403).json({ success: false, message: 'صلاحية الجمعية مطلوبة' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, requireClient };
