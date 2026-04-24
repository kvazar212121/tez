const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function getJwtSecret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (s && String(s).trim()) return String(s).trim();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_JWT_SECRET majburiy (production).');
  }
  return 'dev-admin-jwt-o‘zgartiring';
}

function signAdminToken(row) {
  return jwt.sign(
    { sub: row.id, role: row.role, email: row.email },
    getJwtSecret(),
    { expiresIn: process.env.ADMIN_JWT_EXPIRES || '7d' },
  );
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash || !plain) return false;
  return bcrypt.compare(plain, hash);
}

function adminBearerMiddleware() {
  return (req, res, next) => {
    const h = req.headers.authorization;
    const m = h && /^Bearer\s+(.+)$/i.exec(h);
    if (!m) {
      return res.status(401).json({ message: 'Authorization: Bearer token kerak.' });
    }
    try {
      const payload = jwt.verify(m[1], getJwtSecret());
      req.admin = payload;
      next();
    } catch {
      return res.status(401).json({ message: 'Token yaroqsiz yoki muddati o‘tgan.' });
    }
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Faqat super admin bajarishi mumkin.' });
  }
  next();
}

function requireStaff(req, res, next) {
  const r = req.admin?.role;
  if (r !== 'super_admin' && r !== 'moderator') {
    return res.status(403).json({ message: 'Faqat admin panel xodimlari.' });
  }
  next();
}

module.exports = {
  signAdminToken,
  hashPassword,
  verifyPassword,
  adminBearerMiddleware,
  requireSuperAdmin,
  requireStaff,
};
