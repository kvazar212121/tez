const path = require('path');
const { Pool } = require('pg');

const REGIONS_SEED = require(path.join(__dirname, '..', 'shared', 'regions.json'));

let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDbError(err) {
  const msg = String(err?.message || '');
  const code = err?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' ||
    msg.includes('terminated unexpectedly') ||
    msg.includes('the database system is starting up')
  );
}

async function initSchema() {
  const p = getPool();
  if (!p) {
    console.warn("\u26a0\ufe0f  DATABASE_URL yo\u2019q \u2014 PostgreSQL ulanmagan. backend/.env da DATABASE_URL kiriting.");
    return;
  }

  const createDrivers = `
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      car_model TEXT NOT NULL DEFAULT '',
      car_number TEXT NOT NULL DEFAULT '',
      license_number TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      id_telegram BIGINT UNIQUE
    );
  `;
  const createRegions = `
    CREATE TABLE IF NOT EXISTS regions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      center_name TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0
    );
  `;
  const createDistricts = `
    CREATE TABLE IF NOT EXISTS districts (
      id SERIAL PRIMARY KEY,
      region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      UNIQUE(region_id, name)
    );
  `;

  /**
   * Mijoz buyurtmalari: local (matn) va interregional (regions/districts FK).
   * to_district_id NULL = viloyat/shahar markazi (aniq tuman tanlanmagan).
   * Qidiruv: haydovchi to_district bermasa — faqat to_region_id bo'yicha moslashadi
   * (shu shaharga boradigan istalgan tuman + markaz buyurtmalari chiqadi).
   */
  const createRideRequests = `
    CREATE TABLE IF NOT EXISTS ride_requests (
      id SERIAL PRIMARY KEY,
      order_kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      phone TEXT,
      telegram TEXT,
      from_place TEXT,
      to_place TEXT,
      pickup_lat DOUBLE PRECISION,
      pickup_lng DOUBLE PRECISION,
      from_region_id INT REFERENCES regions(id),
      from_district_id INT REFERENCES districts(id),
      to_region_id INT REFERENCES regions(id),
      to_district_id INT REFERENCES districts(id),
      from_label TEXT,
      to_label TEXT,
      price TEXT,
      "when" TEXT,
      passenger_count INT NOT NULL DEFAULT 1,
      passenger_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      id_telegram BIGINT,
      CONSTRAINT ride_requests_kind_chk CHECK (order_kind IN ('local', 'interregional')),
      CONSTRAINT ride_requests_status_chk CHECK (status IN ('open', 'matched', 'cancelled')),
      CONSTRAINT ride_requests_inter_chk CHECK (
        order_kind <> 'interregional'
        OR (
          from_region_id IS NOT NULL
          AND from_district_id IS NOT NULL
          AND to_region_id IS NOT NULL
        )
      ),
      CONSTRAINT ride_requests_local_chk CHECK (
        order_kind <> 'local'
        OR (
          (to_place IS NOT NULL AND length(trim(to_place)) > 0)
          OR (pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL)
        )
      )
    );
  `;

  const rideRequestIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_ride_requests_inter_open
      ON ride_requests (from_region_id, from_district_id, to_region_id, created_at DESC)
      WHERE order_kind = 'interregional' AND status = 'open'`,
    `CREATE INDEX IF NOT EXISTS idx_ride_requests_inter_to
      ON ride_requests (to_region_id, to_district_id)
      WHERE order_kind = 'interregional'`,
    `CREATE INDEX IF NOT EXISTS idx_ride_requests_local_open
      ON ride_requests (created_at DESC)
      WHERE order_kind = 'local' AND status = 'open'`,
  ];

  /** Alohida admin panel: super_admin (to'liq huquq), moderator (cheklangan). */
  const createAdminUsers = `
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
      CONSTRAINT admin_users_role_chk CHECK (role IN ('super_admin', 'moderator'))
    );
  `;
  const adminUserIndexes = [
    `CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role) WHERE is_active = true`,
    `CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email)`,
  ];

  const createModeratorGroups = `
    CREATE TABLE IF NOT EXISTS moderator_groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  const createModeratorGroupMembers = `
    CREATE TABLE IF NOT EXISTS moderator_group_members (
      group_id INT NOT NULL REFERENCES moderator_groups(id) ON DELETE CASCADE,
      admin_user_id INT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL,
      PRIMARY KEY (group_id, admin_user_id)
    );
  `;
  const moderatorGroupIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_moderator_group_members_admin ON moderator_group_members (admin_user_id)',
  ];

  /** admin_users dan keyin — FK uchun */
  const createComplaints = `
    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      driver_id INT REFERENCES drivers(id) ON DELETE CASCADE,
      phone TEXT DEFAULT '',
      complaint_text TEXT NOT NULL,
      from_who TEXT NOT NULL DEFAULT 'passenger', 
      is_resolved BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  const alterDriverBanCols = [
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ban_reason TEXT',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS banned_by_admin_id INT REFERENCES admin_users(id) ON DELETE SET NULL',
  ];

  const alterCols = [
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS avatar_url TEXT',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_photo_url TEXT',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS origin_place TEXT',
    /** Eski bazada regions/districts jadvallari boshqacha bo'lsa — API so'rovlari ishlashi uchun */
    "ALTER TABLE regions ADD COLUMN IF NOT EXISTS center_name TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE regions ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0',
    'ALTER TABLE districts ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0',
    // To'lov holati ustunlari
    "ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'",
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payment_months INT NOT NULL DEFAULT 1',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payment_note TEXT',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS payment_set_at TIMESTAMPTZ',
    'ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS phone TEXT',
    'ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS telegram TEXT',
    'ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS id_telegram BIGINT',
    'ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS price TEXT',
    'ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS "when" TEXT',
    'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS id_telegram BIGINT UNIQUE',
  ];

  const maxAttempts = 20;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await p.query(createDrivers);
      await p.query(createRegions);
      await p.query(createDistricts);
      for (const stmt of alterCols) {
        await p.query(stmt);
      }
      await seedRegions(p);
      await p.query(createRideRequests);
      for (const idx of rideRequestIndexes) {
        await p.query(idx);
      }
      await p.query(createAdminUsers);
      for (const idx of adminUserIndexes) {
        await p.query(idx);
      }
      for (const stmt of alterDriverBanCols) {
        await p.query(stmt);
      }
      await p.query(createModeratorGroups);
      await p.query(createModeratorGroupMembers);
      for (const idx of moderatorGroupIndexes) {
        await p.query(idx);
      }
      await p.query(
        'ALTER TABLE drivers ADD COLUMN IF NOT EXISTS group_id INT REFERENCES moderator_groups(id) ON DELETE SET NULL',
      );
      await p.query('ALTER TABLE moderator_groups ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE');
      await p.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS signup_invite_code TEXT');

      const { rows: groupsNoCode } = await p.query(
        'SELECT id FROM moderator_groups WHERE invite_code IS NULL'
      );
      for (const g of groupsNoCode) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
          await p.query('UPDATE moderator_groups SET invite_code = $1 WHERE id = $2', [code, g.id]);
        } catch (e) {
          // ignore unique constraint for now, will retry on next run
        }
      }

      await p.query(createComplaints);
      await p.query('ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()');
      await p.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()');
      console.log('\u2705 PostgreSQL: drivers, ride_requests, admin_users, moderator_groups, complaints tekshirildi.');
      return;
    } catch (err) {
      if (attempt < maxAttempts && isRetryableDbError(err)) {
        console.warn(
          `\u23f3 PostgreSQL tayyorlanmoqda, qayta urinilmoqda (${attempt}/${maxAttempts})\u2026`,
        );
        await sleep(delayMs);
        continue;
      }
      console.error('\u274c PostgreSQL init xatolik:', err.message);
      return;
    }
  }
}

async function seedRegions(p) {
  const { rows } = await p.query('SELECT COUNT(*)::int AS c FROM regions');
  if (rows[0].c > 0) return;
  let sort = 0;
  for (const reg of REGIONS_SEED) {
    sort += 1;
    const ins = await p.query(
      `INSERT INTO regions (name, center_name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
      [reg.name, reg.center, sort],
    );
    const rid = ins.rows[0].id;
    let ds = 0;
    for (const d of reg.districts) {
      ds += 1;
      await p.query(`INSERT INTO districts (region_id, name, sort_order) VALUES ($1, $2, $3)`, [
        rid,
        d,
        ds,
      ]);
    }
  }
  console.log('\u2705 PostgreSQL: viloyat va tumanlar bazaga yuklandi.');
}

module.exports = { getPool, initSchema };
