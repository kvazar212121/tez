const express = require('express');
const {
  signAdminToken,
  hashPassword,
  verifyPassword,
  adminBearerMiddleware,
  requireSuperAdmin,
  requireStaff,
} = require('./adminAuth');

function adminRowPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdById: row.created_by_id,
  };
}

function createAdminRouter({ getPool }) {
  const router = express.Router();
  const requireAuth = adminBearerMiddleware();

  /** Diagnostika: `curl http://localhost:5001/api/admin` → 200 bo‘lishi kerak */
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      app: 'taxi-free',
      adminApi: true,
      tip: 'Agar buni ko‘ryapsiz — marshrutlar ulangan. 404 bo‘lsa boshqa jarayon 5001 ni band qilgan.',
    });
  });

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      roles: ['super_admin', 'moderator'],
      auth: 'POST /api/admin/login, Bearer token',
    });
  });

  /** Kirishsiz: nechta admin bor (muammoni aniqlash). Production: faqat son. */
  router.get('/setup-status', async (_req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.json({ ok: false, database: false, adminCount: 0 });
    }
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM admin_users');
      const n = rows[0].n;
      const out = {
        ok: true,
        database: true,
        adminCount: n,
        canBootstrap: n === 0,
        devResetAvailable: process.env.ADMIN_DEV_RESET === 'true',
      };
      if (process.env.NODE_ENV !== 'production') {
        const { rows: list } = await pool.query(
          'SELECT email, role, is_active FROM admin_users ORDER BY id',
        );
        out.admins = list;
      }
      res.json(out);
    } catch (err) {
      console.error('GET /api/admin/setup-status', err);
      res.status(500).json({ ok: false, message: 'Baza so‘rovi xatosi.' });
    }
  });

  /**
   * Faqat lokal dev: barcha adminlarni o‘chirish (keyin bootstrap qayta).
   * .env: ADMIN_DEV_RESET=true
   */
  router.post('/dev/reset-admins', async (_req, res) => {
    if (process.env.ADMIN_DEV_RESET !== 'true') {
      return res.status(403).json({
        message: 'Ruxsat yo‘q. backend/.env da ADMIN_DEV_RESET=true qo‘ying va serverni qayta ishga tushiring.',
      });
    }
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      await pool.query('DELETE FROM moderator_group_members');
      await pool.query('DELETE FROM moderator_groups');
      await pool.query('DELETE FROM admin_users');
      res.json({ ok: true, message: 'admin_users tozalandi. Endi «Birinchi super admin» tugmasini bosing.' });
    } catch (err) {
      console.error('POST /api/admin/dev/reset-admins', err);
      res.status(500).json({ message: 'Tozalashda xatolik.' });
    }
  });

  /** Birinchi super admin — faqat admin_users bo‘sh bo‘lsa. */
  router.post('/bootstrap', async (_req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      const { rows: c } = await pool.query('SELECT COUNT(*)::int AS n FROM admin_users');
      if (c[0].n > 0) {
        return res.status(403).json({
          message: `Bazada allaqachon ${c[0].n} ta admin yozuvi bor — yangi bootstrap o‘chirilgan. Kirish uchun o‘sha email/parol yoki dev tozalash.`,
          adminCount: c[0].n,
        });
      }
      const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@local.dev')
        .trim()
        .toLowerCase();
      const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin123ChangeMe').trim();
      if (password.length < 8) {
        return res.status(400).json({ message: 'ADMIN_BOOTSTRAP_PASSWORD kamida 8 belgi.' });
      }
      const hash = await hashPassword(password);
      const name = String(process.env.ADMIN_BOOTSTRAP_NAME || 'Super admin').trim() || 'Super admin';
      const ins = await pool.query(
        `INSERT INTO admin_users (email, password_hash, role, display_name)
         VALUES ($1, $2, 'super_admin', $3)
         RETURNING id, email, role, display_name, created_at`,
        [email, hash, name],
      );
      res.status(201).json({
        ok: true,
        user: adminRowPublic(ins.rows[0]),
        hint: 'Keyingi kirish: POST /api/admin/login. Production: ADMIN_JWT_SECRET va kuchli parol.',
      });
    } catch (err) {
      console.error('POST /api/admin/bootstrap', err);
      res.status(500).json({ message: 'Bootstrap xatosi.' });
    }
  });

  router.post('/login', async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ message: 'email va password kiriting.' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT * FROM admin_users WHERE lower(trim(email)) = $1 AND is_active = true',
        [email],
      );
      if (!rows.length) {
        return res.status(401).json({ message: 'Email yoki parol noto‘g‘ri.' });
      }
      const row = rows[0];
      const ok = await verifyPassword(password, row.password_hash);
      if (!ok) {
        return res.status(401).json({ message: 'Email yoki parol noto‘g‘ri.' });
      }
      const token = signAdminToken(row);
      res.json({
        token,
        user: adminRowPublic(row),
      });
    } catch (err) {
      console.error('POST /api/admin/login', err);
      res.status(500).json({ message: 'Kirishda xatolik.' });
    }
  });

  router.get('/me', requireAuth, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT id, email, role, display_name, is_active, created_at, created_by_id FROM admin_users WHERE id = $1',
        [req.admin.sub],
      );
      if (!rows.length) {
        return res.status(401).json({ message: 'Foydalanuvchi topilmadi.' });
      }
      res.json(adminRowPublic(rows[0]));
    } catch (err) {
      console.error('GET /api/admin/me', err);
      res.status(500).json({ message: 'Ma’lumot olishda xatolik.' });
    }
  });

  async function adminUserWithGroups(pool, userId) {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.role, u.display_name, u.is_active, u.created_at, u.created_by_id,
        COALESCE(g.groups, '[]'::json) AS groups
       FROM admin_users u
       LEFT JOIN (
         SELECT m.admin_user_id,
           json_agg(json_build_object('id', gr.id, 'name', gr.name) ORDER BY gr.sort_order, gr.id) AS groups
         FROM moderator_group_members m
         JOIN moderator_groups gr ON gr.id = m.group_id
         GROUP BY m.admin_user_id
       ) g ON g.admin_user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...adminRowPublic(r), groups: r.groups || [] };
  }

  router.get('/users', requireAuth, requireSuperAdmin, async (_req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.role, u.display_name, u.is_active, u.created_at, u.created_by_id,
          COALESCE(g.groups, '[]'::json) AS groups
         FROM admin_users u
         LEFT JOIN (
           SELECT m.admin_user_id,
             json_agg(json_build_object('id', gr.id, 'name', gr.name) ORDER BY gr.sort_order, gr.id) AS groups
           FROM moderator_group_members m
           JOIN moderator_groups gr ON gr.id = m.group_id
           GROUP BY m.admin_user_id
         ) g ON g.admin_user_id = u.id
         ORDER BY u.role, u.id`,
      );
      res.json(
        rows.map((r) => ({
          ...adminRowPublic(r),
          groups: Array.isArray(r.groups) ? r.groups : [],
        })),
      );
    } catch (err) {
      console.error('GET /api/admin/users', err);
      res.status(500).json({ message: 'Ro‘yxat xatosi.' });
    }
  });

  router.patch('/users/:userId', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const targetId = parseInt(req.params.userId, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri ID.' });
    }
    if (targetId === req.admin.sub) {
      return res.status(400).json({ message: 'O‘z akkauntingizni shu yerda bloklay olmaysiz.' });
    }
    if (typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive: true yoki false kiriting.' });
    }
    try {
      const { rows: cur } = await pool.query('SELECT id, role FROM admin_users WHERE id = $1', [targetId]);
      if (!cur.length) {
        return res.status(404).json({ message: 'Foydalanuvchi topilmadi.' });
      }
      if (cur[0].role !== 'moderator') {
        return res.status(400).json({ message: 'Faqat moderator faolligi o‘zgartiriladi.' });
      }
      await pool.query('UPDATE admin_users SET is_active = $1 WHERE id = $2', [req.body.isActive, targetId]);
      const out = await adminUserWithGroups(pool, targetId);
      res.json(out);
    } catch (err) {
      console.error('PATCH /api/admin/users/:id', err);
      res.status(500).json({ message: 'Saqlanmadi.' });
    }
  });

  router.delete('/users/:userId', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const targetId = parseInt(req.params.userId, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri ID.' });
    }
    if (targetId === req.admin.sub) {
      return res.status(400).json({ message: 'O‘zingizni o‘cha olmaysiz.' });
    }
    try {
      const { rows: cur } = await pool.query('SELECT role FROM admin_users WHERE id = $1', [targetId]);
      if (!cur.length) {
        return res.status(404).json({ message: 'Foydalanuvchi topilmadi.' });
      }
      if (cur[0].role !== 'moderator') {
        return res.status(400).json({ message: 'Super admin o‘chirib bo‘lmaydi.' });
      }
      await pool.query('DELETE FROM admin_users WHERE id = $1', [targetId]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/admin/users/:id', err);
      res.status(500).json({ message: 'O‘chirilmadi.' });
    }
  });

  router.post('/users/:userId/leave-groups', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const targetId = parseInt(req.params.userId, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri ID.' });
    }
    try {
      const { rows: cur } = await pool.query('SELECT role FROM admin_users WHERE id = $1', [targetId]);
      if (!cur.length) {
        return res.status(404).json({ message: 'Foydalanuvchi topilmadi.' });
      }
      if (cur[0].role !== 'moderator') {
        return res.status(400).json({ message: 'Faqat moderator uchun.' });
      }
      await pool.query('DELETE FROM moderator_group_members WHERE admin_user_id = $1', [targetId]);
      const out = await adminUserWithGroups(pool, targetId);
      res.json(out);
    } catch (err) {
      console.error('POST /api/admin/users/:id/leave-groups', err);
      res.status(500).json({ message: 'Guruhlardan ajratib bo‘lmadi.' });
    }
  });

  router.post('/users/moderator', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || 'Moderator').trim() || 'Moderator';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'To‘g‘ri email kiriting.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Parol kamida 8 belgi.' });
    }
    try {
      await pool.query('BEGIN');
      const hash = await hashPassword(password);
      
      // 1. Moderator yaratish
      const ins = await pool.query(
        `INSERT INTO admin_users (email, password_hash, role, display_name, created_by_id)
         VALUES ($1, $2, 'moderator', $3, $4)
         RETURNING id, email, role, display_name, created_at, created_by_id`,
        [email, hash, displayName, req.admin.sub],
      );
      const mod = ins.rows[0];

      // 2. Guruh yaratish (Moderator nomi bilan)
      const groupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const groupRes = await pool.query(
        `INSERT INTO moderator_groups (name, description, invite_code)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [displayName, `Moderator ${displayName} uchun avtomatik guruh`, groupCode]
      );
      const groupId = groupRes.rows[0].id;

      // 3. Biriktirish
      await pool.query(
        `INSERT INTO moderator_group_members (group_id, admin_user_id, assigned_by_admin_id)
         VALUES ($1, $2, $3)`,
        [groupId, mod.id, req.admin.sub]
      );

      await pool.query('COMMIT');
      res.status(201).json(adminRowPublic(mod));
    } catch (err) {
      await pool.query('ROLLBACK');
      if (err.code === '23505') {
        const msg = err.constraint === 'moderator_groups_name_key' 
          ? 'Bunday nomli guruh allaqachon bor, boshqacha ism ishlating.'
          : 'Bu email allaqachon ro‘yxatdan o‘tgan.';
        return res.status(409).json({ message: msg });
      }
      console.error('POST /api/admin/users/moderator', err);
      res.status(500).json({ message: 'Moderator yaratishda xatolik.' });
    }
  });

  function driverAdminJson(row) {
    if (!row) return null;
    // To’lov muddati tugaganini avtomatik aniqlash
    const paymentStatus = row.payment_status || 'unpaid';
    const expiresAt = row.payment_expires_at || null;
    const isExpired = expiresAt && new Date(expiresAt) < new Date();
    const effectiveStatus = isExpired ? 'expired' : paymentStatus;
    return {
      id: row.id,
      fullName: row.full_name ?? '',
      phone: row.phone ?? '',
      carModel: row.car_model ?? '',
      carNumber: row.car_number ?? '',
      isBanned: row.is_banned === true,
      banReason: row.ban_reason || null,
      bannedAt: row.banned_at,
      createdAt: row.created_at,
      groupId: row.group_id != null ? row.group_id : null,
      groupName: row.group_name || null,
      paymentStatus: effectiveStatus,
      paymentExpiresAt: expiresAt,
      paymentMonths: row.payment_months || 1,
      paymentNote: row.payment_note || null,
      paymentSetAt: row.payment_set_at || null,
    };
  }

  function groupPublic(g, members, driverCount) {
    const dc =
      driverCount !== undefined && driverCount !== null
        ? Number(driverCount)
        : Number(g.driver_count) || 0;
    return {
      id: g.id,
      name: g.name,
      description: g.description || '',
      sortOrder: g.sort_order,
      createdAt: g.created_at,
      inviteCode: g.invite_code || null,
      inviteLink: g.invite_code ? `https://t.me/yurtaxi_bot?start=${g.invite_code}` : null,
      members: members || [],
      driverCount: Number.isFinite(dc) ? dc : 0,
    };
  }

  async function fetchGroupsWithMembers(pool, onlyGroupIds) {
    /** drivers.group_id yo‘q bo‘lsa (eski baza) — haydovchi soni 0 deb qaytadi, ro‘yxat baribir ishlasin */
    async function loadGroupRows(withDriverCount) {
      const countSql = withDriverCount
        ? `COALESCE((SELECT COUNT(*)::int FROM drivers d WHERE d.group_id = mg.id), 0) AS driver_count`
        : `0::int AS driver_count`;
      if (onlyGroupIds != null) {
        if (!onlyGroupIds.length) return { rows: [] };
        return pool.query(
          `SELECT mg.*, ${countSql}
           FROM moderator_groups mg WHERE mg.id = ANY($1::int[]) ORDER BY mg.sort_order ASC, mg.id ASC`,
          [onlyGroupIds],
        );
      }
      return pool.query(
        `SELECT mg.*, ${countSql} FROM moderator_groups mg ORDER BY mg.sort_order ASC, mg.id ASC`,
      );
    }

    let groupsRes;
    try {
      groupsRes = await loadGroupRows(true);
    } catch (err) {
      if (err.code === '42703') {
        groupsRes = await loadGroupRows(false);
      } else {
        throw err;
      }
    }
    const groups = groupsRes.rows;
    if (!groups.length) return [];
    const ids = groups.map((g) => g.id);
    const { rows: memRows } = await pool.query(
      `SELECT m.group_id, a.id, a.email, a.display_name, a.role, a.is_active
       FROM moderator_group_members m
       INNER JOIN admin_users a ON a.id = m.admin_user_id
       WHERE m.group_id = ANY($1::int[])
       ORDER BY a.role, a.id`,
      [ids],
    );
    const byG = new Map();
    for (const g of groups) byG.set(g.id, []);
    for (const r of memRows) {
      const list = byG.get(r.group_id);
      if (list) {
        list.push({
          id: r.id,
          email: r.email,
          displayName: r.display_name,
          role: r.role,
          isActive: r.is_active,
        });
      }
    }
    return groups.map((g) => groupPublic(g, byG.get(g.id) || [], g.driver_count));
  }

  router.get('/stats', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      if (req.admin.role === 'super_admin') {
        const { rows } = await pool.query(`SELECT
          (SELECT COUNT(*)::int FROM admin_users WHERE is_active = true AND role = 'super_admin') AS super_admins,
          (SELECT COUNT(*)::int FROM admin_users WHERE is_active = true AND role = 'moderator') AS moderators,
          (SELECT COUNT(*)::int FROM admin_users WHERE is_active = false) AS admins_inactive,
          (SELECT COUNT(*)::int FROM moderator_groups) AS groups,
          (SELECT COUNT(*)::int FROM drivers) AS drivers,
          (SELECT COUNT(*)::int FROM drivers WHERE is_banned = true) AS drivers_banned,
          (SELECT COUNT(*)::int FROM ride_requests) AS ride_requests_total,
          (SELECT COUNT(*)::int FROM ride_requests WHERE status = 'open') AS ride_open,
          (SELECT COUNT(*)::int FROM ride_requests WHERE status = 'matched') AS ride_matched,
          (SELECT COUNT(*)::int FROM ride_requests WHERE status = 'cancelled') AS ride_cancelled,
          (SELECT COUNT(*)::int FROM ride_requests WHERE created_at > NOW() - INTERVAL '24 hours') AS rides_24h,
          (SELECT COUNT(*)::int FROM ride_requests WHERE created_at > NOW() - INTERVAL '7 days') AS rides_7d
        `);
        return res.json(rows[0]);
      } else {
        // Moderator: faqat o'ziga biriktirilgan guruhlardagi haydovchilar statistikasi
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        const gids = mine.map((r) => r.group_id);

        if (gids.length === 0) {
          return res.json({
            super_admins: 0,
            moderators: 0,
            admins_inactive: 0,
            groups: 0,
            drivers: 0,
            drivers_banned: 0,
            ride_requests_total: 0,
            ride_open: 0,
            ride_matched: 0,
            ride_cancelled: 0,
            rides_24h: 0,
            rides_7d: 0,
          });
        }

        const { rows } = await pool.query(
          `SELECT
            0 AS super_admins,
            0 AS moderators,
            0 AS admins_inactive,
            (SELECT COUNT(*)::int FROM moderator_groups WHERE id = ANY($1::int[])) AS groups,
            (SELECT COUNT(*)::int FROM drivers WHERE group_id = ANY($1::int[])) AS drivers,
            (SELECT COUNT(*)::int FROM drivers WHERE group_id = ANY($1::int[]) AND is_banned = true) AS drivers_banned,
            0 AS ride_requests_total,
            0 AS ride_open,
            0 AS ride_matched,
            0 AS ride_cancelled,
            0 AS rides_24h,
            0 AS rides_7d`,
          [gids],
        );
        res.json(rows[0]);
      }
    } catch (err) {
      console.error('GET /api/admin/stats', err);
      res.status(500).json({ message: 'Statistika xatosi.' });
    }
  });

  router.get('/drivers', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const onlyBanned = String(req.query.banned || '') === '1';
    try {
      let gids = null;
      if (req.admin.role !== 'super_admin') {
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        gids = mine.map((r) => r.group_id);
        if (gids.length === 0) return res.json([]);
      }

      let query;
      let params = [limit];

      if (gids) {
        query = onlyBanned
          ? `SELECT d.*, mg.name AS group_name FROM drivers d
             LEFT JOIN moderator_groups mg ON mg.id = d.group_id
             WHERE d.group_id = ANY($2::int[]) AND d.is_banned = true
             ORDER BY d.banned_at DESC NULLS LAST, d.id DESC LIMIT $1`
          : `SELECT d.*, mg.name AS group_name FROM drivers d
             LEFT JOIN moderator_groups mg ON mg.id = d.group_id
             WHERE d.group_id = ANY($2::int[])
             ORDER BY d.id DESC LIMIT $1`;
        params.push(gids);
      } else {
        query = onlyBanned
          ? `SELECT d.*, mg.name AS group_name FROM drivers d
             LEFT JOIN moderator_groups mg ON mg.id = d.group_id
             WHERE d.is_banned = true
             ORDER BY d.banned_at DESC NULLS LAST, d.id DESC LIMIT $1`
          : `SELECT d.*, mg.name AS group_name FROM drivers d
             LEFT JOIN moderator_groups mg ON mg.id = d.group_id
             ORDER BY d.id DESC LIMIT $1`;
      }

      const { rows } = await pool.query(query, params);
      res.json(rows.map(driverAdminJson));
    } catch (err) {
      console.error('GET /api/admin/drivers', err);
      res.status(500).json({ message: 'Haydovchilar ro‘yxati xatosi.' });
    }
  });

  router.post('/drivers/:driverId/ban', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri haydovchi ID.' });
    }
    if (typeof req.body?.banned === 'undefined') {
      return res.status(400).json({ message: 'banned: true (bloklash) yoki false (blokdan chiqarish) kiriting.' });
    }
    const banned = req.body.banned === true || req.body.banned === 'true';
    const reason = banned ? String(req.body?.reason || '').trim() || null : null;
    try {
      if (req.admin.role !== 'super_admin') {
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        const gids = mine.map((r) => r.group_id);
        const { rows: dr } = await pool.query('SELECT group_id FROM drivers WHERE id = $1', [driverId]);
        if (!dr.length) return res.status(404).json({ message: 'Haydovchi topilmadi.' });
        if (!dr[0].group_id || !gids.includes(dr[0].group_id)) {
          return res.status(403).json({ message: 'Ushbu haydovchini bloklash uchun ruxsat yo‘q.' });
        }
      }

      await pool.query(
        banned
          ? `UPDATE drivers SET is_banned = true, ban_reason = $1, banned_at = NOW(), banned_by_admin_id = $2 WHERE id = $3`
          : `UPDATE drivers SET is_banned = false, ban_reason = NULL, banned_at = NULL, banned_by_admin_id = NULL WHERE id = $1`,
        banned ? [reason, req.admin.sub, driverId] : [driverId],
      );

      const { rows: withG } = await pool.query(
        `SELECT d.*, mg.name AS group_name FROM drivers d
         LEFT JOIN moderator_groups mg ON mg.id = d.group_id WHERE d.id = $1`,
        [driverId],
      );
      res.json(driverAdminJson(withG[0]));
    } catch (err) {
      console.error('POST /api/admin/drivers/:id/ban', err);
      res.status(500).json({ message: 'Ban holatini saqlab bo‘lmadi.' });
    }
  });

  router.post('/drivers/:driverId/group', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri haydovchi ID.' });
    }
    const raw = req.body?.groupId;
    let gid = null;
    if (raw != null && raw !== '') {
      gid = parseInt(raw, 10);
      if (Number.isNaN(gid)) {
        return res.status(400).json({ message: 'Noto‘g‘ri guruh ID.' });
      }
    }
    try {
      const { rows: dr } = await pool.query('SELECT id FROM drivers WHERE id = $1', [driverId]);
      if (!dr.length) {
        return res.status(404).json({ message: 'Haydovchi topilmadi.' });
      }
      if (gid != null) {
        const { rows: gr } = await pool.query('SELECT id FROM moderator_groups WHERE id = $1', [gid]);
        if (!gr.length) {
          return res.status(404).json({ message: 'Guruh topilmadi.' });
        }
      }
      await pool.query('UPDATE drivers SET group_id = $1 WHERE id = $2', [gid, driverId]);
      const { rows } = await pool.query(
        `SELECT d.*, mg.name AS group_name FROM drivers d
         LEFT JOIN moderator_groups mg ON mg.id = d.group_id WHERE d.id = $1`,
        [driverId],
      );
      res.json(driverAdminJson(rows[0]));
    } catch (err) {
      if (err.code === '42703') {
        return res.status(503).json({
          message:
            'drivers.group_id ustuni yo‘q. Loyihaning yangi backendini ishga tushiring (PostgreSQL migratsiyasi).',
        });
      }
      console.error('POST /api/admin/drivers/:id/group', err);
      res.status(500).json({ message: 'Guruh biriktirilmadi.' });
    }
  });

  // ── To’lov holati: moderator + super_admin o’zgartirishi mumkin ──
  router.post('/drivers/:driverId/payment', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) return res.status(400).json({ message: 'Noto’g’ri haydovchi ID.' });

    const status = String(req.body?.status || '').trim();
    if (!['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({ message: 'status: paid yoki unpaid bo’lishi kerak.' });
    }
    const months = Math.min(12, Math.max(1, parseInt(req.body?.months || '1', 10) || 1));
    const note = req.body?.note != null ? String(req.body.note).trim() || null : null;

    try {
      const { rows: dr } = await pool.query('SELECT group_id FROM drivers WHERE id = $1', [driverId]);
      if (!dr.length) return res.status(404).json({ message: 'Haydovchi topilmadi.' });

      if (req.admin.role !== 'super_admin') {
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        const gids = mine.map((r) => r.group_id);
        if (!dr[0].group_id || !gids.includes(dr[0].group_id)) {
          return res.status(403).json({ message: 'Ushbu haydovchi to‘lovini boshqarish uchun ruxsat yo‘q.' });
        }
      }

      let expiresAt = null;
      if (status === 'paid') {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        expiresAt = d.toISOString();
      }

      await pool.query(
        `UPDATE drivers
         SET payment_status = $1, payment_expires_at = $2, payment_months = $3,
             payment_note = $4, payment_set_at = NOW()
         WHERE id = $5`,
        [status, expiresAt, months, note, driverId],
      );

      const { rows: updated } = await pool.query(
        `SELECT d.*, mg.name AS group_name FROM drivers d
         LEFT JOIN moderator_groups mg ON mg.id = d.group_id WHERE d.id = $1`,
        [driverId],
      );
      res.json(driverAdminJson(updated[0]));
    } catch (err) {
      console.error('POST /api/admin/drivers/:id/payment', err);
      res.status(500).json({ message: 'To’lov holati saqlanmadi.' });
    }
  });

  router.delete('/drivers/:driverId', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ message: 'Ma`lumotlar bazasi mavjud emas.' });
    const driverId = parseInt(req.params.driverId, 10);
    if (Number.isNaN(driverId)) return res.status(400).json({ message: 'Noto`g`ri haydovchi ID.' });

    try {
      const { rows: dr } = await pool.query('SELECT group_id FROM drivers WHERE id = $1', [driverId]);
      if (!dr.length) return res.status(404).json({ message: 'Haydovchi topilmadi oki allaqachon o`chirilgan.' });

      if (req.admin.role !== 'super_admin') {
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        const gids = mine.map((r) => r.group_id);
        if (!dr[0].group_id || !gids.includes(dr[0].group_id)) {
          return res.status(403).json({ message: 'Ushbu haydovchini o‘chirish uchun ruxsat yo‘q.' });
        }
      }

      await pool.query('DELETE FROM drivers WHERE id = $1', [driverId]);
      res.json({ success: true, message: 'Haydovchi o`chirib yuborildi.' });
    } catch (err) {
      console.error('DELETE /api/admin/drivers/:id', err);
      res.status(500).json({ message: 'Haydovchini o`chirishda xatolik yuz berdi.' });
    }
  });

  // --- E'tirozlar API ---
  router.get('/complaints', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ message: 'Ma`lumotlar bazasi mavjud emas.' });
    
    try {
      let gids = null;
      if (req.admin.role !== 'super_admin') {
        const { rows: mine } = await pool.query(
          `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
          [req.admin.sub],
        );
        gids = mine.map((r) => r.group_id);
        if (gids.length === 0) return res.json([]);
      }

      let query;
      let params = [];

      if (gids) {
        query = `
          SELECT c.*, 
                 d.full_name as driver_name, d.car_number as driver_car 
          FROM complaints c
          LEFT JOIN drivers d ON d.id = c.driver_id
          WHERE d.group_id = ANY($1::int[]) OR c.driver_id IS NULL
          ORDER BY c.created_at DESC
          LIMIT 500
        `;
        params.push(gids);
      } else {
        query = `
          SELECT c.*, 
                 d.full_name as driver_name, d.car_number as driver_car 
          FROM complaints c
          LEFT JOIN drivers d ON d.id = c.driver_id
          ORDER BY c.created_at DESC
          LIMIT 500
        `;
      }

      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      if (err.code === '42P01') return res.json([]); 
      console.error('GET /api/admin/complaints', err);
      res.status(500).json({ message: 'E`tirozlarni yuklashda xatolik.' });
    }
  });

  router.post('/complaints/:id/resolve', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) return res.status(503).json({ message: 'Ma`lumotlar bazasi mavjud emas.' });
    const cId = parseInt(req.params.id, 10);
    
    try {
      const { rows } = await pool.query('UPDATE complaints SET is_resolved = true WHERE id = $1 RETURNING *', [cId]);
      if (!rows.length) return res.status(404).json({ message: 'Topilmadi' });
      res.json(rows[0]);
    } catch (err) {
      console.error('POST /api/admin/complaints/:id/resolve', err);
      res.status(500).json({ message: 'Holatni yangilashda xato' });
    }
  });

  router.get('/groups', requireAuth, requireStaff, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    try {
      if (req.admin.role === 'super_admin') {
        const data = await fetchGroupsWithMembers(pool, undefined);
        return res.json(data);
      }
      const { rows: mine } = await pool.query(
        `SELECT group_id FROM moderator_group_members WHERE admin_user_id = $1`,
        [req.admin.sub],
      );
      const ids = mine.map((r) => r.group_id);
      const data = await fetchGroupsWithMembers(pool, ids.length ? ids : []);
      return res.json(data);
    } catch (err) {
      console.error('GET /api/admin/groups', err);
      res.status(500).json({ message: 'Guruhlar ro‘yxati xatosi.' });
    }
  });

  router.post('/groups', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!name.length) {
      return res.status(400).json({ message: 'Guruh nomini kiriting.' });
    }
    try {
      const ins = await pool.query(
        `INSERT INTO moderator_groups (name, description) VALUES ($1, $2)
         RETURNING *`,
        [name, description],
      );
      res.status(201).json(groupPublic(ins.rows[0], [], 0));
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Bu nom bilan guruh allaqachon bor.' });
      }
      if (err.code === '42P01') {
        return res.status(503).json({
          message:
            'moderator_groups jadvali yo‘q. PostgreSQL ishlayotganini tekshiring va backendni qayta ishga tushiring.',
        });
      }
      console.error('POST /api/admin/groups', err);
      res.status(500).json({
        message: 'Guruh yaratilmadi. PostgreSQL va backend logini tekshiring.',
      });
    }
  });

  router.patch('/groups/:groupId', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const groupId = parseInt(req.params.groupId, 10);
    if (Number.isNaN(groupId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri guruh ID.' });
    }
    const name = req.body?.name != null ? String(req.body.name).trim() : null;
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    const sortOrder = req.body?.sortOrder != null ? parseInt(req.body.sortOrder, 10) : null;
    try {
      const cur = await pool.query('SELECT * FROM moderator_groups WHERE id = $1', [groupId]);
      if (!cur.rows.length) {
        return res.status(404).json({ message: 'Guruh topilmadi.' });
      }
      const row = cur.rows[0];
      const nextName = name !== null && name.length ? name : row.name;
      const nextDesc = description !== null ? description : row.description;
      const nextSort = sortOrder !== null && !Number.isNaN(sortOrder) ? sortOrder : row.sort_order;
      await pool.query(
        `UPDATE moderator_groups SET name = $1, description = $2, sort_order = $3 WHERE id = $4`,
        [nextName, nextDesc, nextSort, groupId],
      );
      const data = await fetchGroupsWithMembers(pool, [groupId]);
      res.json(
        data[0] || groupPublic({ ...row, name: nextName, description: nextDesc, sort_order: nextSort }, [], 0),
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Bu nom bilan guruh allaqachon bor.' });
      }
      console.error('PATCH /api/admin/groups/:id', err);
      res.status(500).json({ message: 'Guruh yangilanmadi.' });
    }
  });

  router.delete('/groups/:groupId', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const groupId = parseInt(req.params.groupId, 10);
    if (Number.isNaN(groupId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri guruh ID.' });
    }
    try {
      const del = await pool.query('DELETE FROM moderator_groups WHERE id = $1 RETURNING id', [groupId]);
      if (!del.rows.length) {
        return res.status(404).json({ message: 'Guruh topilmadi.' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/admin/groups/:id', err);
      res.status(500).json({ message: 'Guruh o‘chirilmadi.' });
    }
  });

  router.post('/groups/:groupId/members', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const groupId = parseInt(req.params.groupId, 10);
    const adminUserId = parseInt(req.body?.adminUserId ?? req.body?.admin_user_id, 10);
    if (Number.isNaN(groupId) || Number.isNaN(adminUserId)) {
      return res.status(400).json({ message: 'groupId va adminUserId kerak.' });
    }
    try {
      const g = await pool.query('SELECT 1 FROM moderator_groups WHERE id = $1', [groupId]);
      if (!g.rows.length) {
        return res.status(404).json({ message: 'Guruh topilmadi.' });
      }
      const u = await pool.query(
        `SELECT id, role FROM admin_users WHERE id = $1 AND is_active = true`,
        [adminUserId],
      );
      if (!u.rows.length) {
        return res.status(404).json({ message: 'Admin foydalanuvchi topilmadi yoki o‘chiq.' });
      }
      if (u.rows[0].role !== 'moderator') {
        return res.status(400).json({ message: 'Faqat moderator ro‘li guruhga qo‘shiladi.' });
      }
      await pool.query(
        `INSERT INTO moderator_group_members (group_id, admin_user_id, assigned_by_admin_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (group_id, admin_user_id) DO NOTHING`,
        [groupId, adminUserId, req.admin.sub],
      );
      const data = await fetchGroupsWithMembers(pool, [groupId]);
      res.json(data[0]);
    } catch (err) {
      console.error('POST /api/admin/groups/:id/members', err);
      res.status(500).json({ message: 'A’zo qo‘shilmadi.' });
    }
  });

  router.delete('/groups/:groupId/members/:adminUserId', requireAuth, requireSuperAdmin, async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const groupId = parseInt(req.params.groupId, 10);
    const adminUserId = parseInt(req.params.adminUserId, 10);
    if (Number.isNaN(groupId) || Number.isNaN(adminUserId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri ID.' });
    }
    try {
      await pool.query(
        `DELETE FROM moderator_group_members WHERE group_id = $1 AND admin_user_id = $2`,
        [groupId, adminUserId],
      );
      const data = await fetchGroupsWithMembers(pool, [groupId]);
      res.json(data[0] || { id: groupId, members: [] });
    } catch (err) {
      console.error('DELETE /api/admin/groups/:id/members', err);
      res.status(500).json({ message: 'A’zo olib tashlanmadi.' });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
