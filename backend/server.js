const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const { getPool, initSchema } = require('./db');
const { DEFAULT_PORT } = require('./config');
const { createAdminRouter } = require('./adminRouter');
require('./telegramBot'); // Botni ishga tushirish qatori qo'shildi

const REGIONS_STATIC = require(path.join(__dirname, '..', 'shared', 'regions.json'));

function regionsJsonFromStatic() {
  return REGIONS_STATIC.map((r, i) => ({
    id: i + 1,
    name: r.name,
    center: r.center,
    sortOrder: i + 1,
    districts: r.districts.map((d, j) => ({
      id: (i + 1) * 10000 + j + 1,
      name: d,
      sortOrder: j + 1,
    })),
  }));
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      cb(new Error('Faqat rasm fayli yuklash mumkin'));
      return;
    }
    cb(null, true);
  },
});

function unlinkFile(filename) {
  if (!filename) return;
  const fp = path.join(UPLOAD_DIR, filename);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    console.warn('Fayl o‘chirish:', e.message);
  }
}

function rideRequestRowToJson(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    orderKind: row.order_kind,
    status: row.status,
    phone: row.phone,
    telegram: row.telegram,
    fromPlace: row.from_place,
    toPlace: row.to_place,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    fromRegionId: row.from_region_id,
    fromDistrictId: row.from_district_id,
    toRegionId: row.to_region_id,
    toDistrictId: row.to_district_id,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    price: row.price,
    when: row.when,
    // Add compatible aliases for frontend popup
    from: row.from_label || row.from_place,
    to: row.to_label || row.to_place,
    passengerCount: row.passenger_count,
    passengerNotes: row.passenger_notes,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    id_telegram: row.id_telegram,
  };
}

async function assertDistrictInRegion(pool, districtId, regionId) {
  const { rows } = await pool.query('SELECT 1 FROM districts WHERE id = $1 AND region_id = $2', [
    districtId,
    regionId,
  ]);
  return rows.length > 0;
}

function driverRowToJson(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }
    const banned = row.is_banned === true;
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    phone: row.phone ?? '',
    carModel: row.car_model ?? '',
    carNumber: row.car_number ?? '',
    licenseNumber: row.license_number || '',
    originPlace: row.origin_place || '',
    avatarUrl: row.avatar_url ? `/uploads/${row.avatar_url}` : null,
    carPhotoUrl: row.car_photo_url ? `/uploads/${row.car_photo_url}` : null,
    createdAt: row.created_at,
    isBanned: banned,
    banReason: banned ? row.ban_reason || null : null,
    bannedAt: banned ? row.banned_at : null,
    groupId: row.group_id != null ? row.group_id : null,
    groupName: row.group_name || null,
    lastSeenAt: row.last_seen_at || null,
    idTelegram: row.id_telegram != null ? row.id_telegram : null,
  };
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/admin', createAdminRouter({ getPool }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: Boolean(getPool()) });
});

/** Viloyatlar va tumanlar (bazada bo‘lsa ID lar bilan; bo‘lmasa shared/regions.json) */
app.get('/api/regions', async (_req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.json(regionsJsonFromStatic());
  }
  try {
    const { rows: regions } = await pool.query(
      'SELECT id, name, center_name AS center, sort_order AS "sortOrder" FROM regions ORDER BY sort_order, id',
    );
    const { rows: districts } = await pool.query(
      'SELECT id, region_id AS "regionId", name, sort_order AS "sortOrder" FROM districts ORDER BY region_id, sort_order, id',
    );
    if (regions.length === 0) {
      return res.json(regionsJsonFromStatic());
    }
    const out = regions.map((r) => ({
      id: r.id,
      name: r.name,
      center: r.center,
      sortOrder: r.sortOrder,
      districts: districts
        .filter((d) => d.regionId === r.id)
        .map((d) => ({ id: d.id, name: d.name, sortOrder: d.sortOrder })),
    }));
    res.json(out);
  } catch (err) {
    console.error('GET /api/regions — bazadan o‘qib bo‘lmadi, static fayl ishlatiladi:', err.message);
    res.json(regionsJsonFromStatic());
  }
});

/** Haydovchi ro‘yxatdan o‘tishi */
app.post('/api/drivers', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({
      message: "PostgreSQL ulanmagan. backend/.env da DATABASE_URL ni ko'rsating.",
    });
  }

  const body = req.body || {};
  const full_name = String(body.fullName ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const car_model = String(body.carModel ?? '').trim();
  const car_number = String(body.carNumber ?? '').trim();
  const license_number = String(body.licenseNumber ?? '').trim();
  const invite_code = String(body.inviteCode ?? '').trim().toUpperCase();
  const id_telegram = body.idTelegram != null ? body.idTelegram : null;

  if (!full_name && !phone) {
    return res.status(400).json({ message: "Kamida ism yoki telefon kiriting (demo)." });
  }

  try {
    let group_id = null;
    if (invite_code) {
      const { rows: grMeta } = await pool.query(
        'SELECT id FROM moderator_groups WHERE invite_code = $1',
        [invite_code]
      );
      if (grMeta.length > 0) {
        group_id = grMeta[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO drivers (full_name, phone, car_model, car_number, license_number, group_id, signup_invite_code, id_telegram)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id_telegram) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         car_model = EXCLUDED.car_model,
         car_number = EXCLUDED.car_number,
         license_number = EXCLUDED.license_number,
         group_id = COALESCE(EXCLUDED.group_id, drivers.group_id)
       RETURNING id, created_at`,
      [
        full_name || '—',
        phone || '—',
        car_model || '—',
        car_number || '—',
        license_number || null,
        group_id,
        invite_code || null,
        id_telegram
      ],
    );
    res.status(201).json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('POST /api/drivers', err);
    res.status(500).json({ message: 'Ma’lumotlar bazasiga yozishda xatolik.' });
  }
});

/** Haydovchini Telegram ID orqali olish */
app.get('/api/drivers/telegram/:telegramId', async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json({ message: 'Bazaga ulanmagan' });
  
  const telegramId = req.params.telegramId;
  try {
    const { rows } = await pool.query(
      `SELECT d.*, mg.name AS group_name FROM drivers d
       LEFT JOIN moderator_groups mg ON mg.id = d.group_id 
       WHERE d.id_telegram = $1`,
      [telegramId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Topilmadi' });
    res.json(driverRowToJson(rows[0]));
  } catch (err) {
    console.error('GET /api/drivers/telegram/:telegramId', err);
    res.status(500).json({ message: 'Server xatosi' });
  }
});

/** Haydovchi profilini olish */
app.get('/api/drivers/:id', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
  }
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Noto‘g‘ri ID' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT d.*, mg.name AS group_name FROM drivers d
       LEFT JOIN moderator_groups mg ON mg.id = d.group_id WHERE d.id = $1`,
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Topilmadi' });
    }
    const json = driverRowToJson(rows[0]);
    if (!json) {
      return res.status(500).json({ message: 'Ma’lumotni qayta ishlashda xatolik' });
    }
    res.json(json);
  } catch (err) {
    console.error('GET /api/drivers/:id', err.code || '', err.message);
    res.status(503).json({
      message:
        'Ma’lumotlar bazasiga ulanishda muammo. PostgreSQL ishlayotganini va backend/.env dagi DATABASE_URL ni tekshiring.',
    });
  }
});

/** Profil rasmlari va “qayerdan” */
app.patch(
  '/api/drivers/:id',
  (req, res, next) => {
    upload.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'carPhoto', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Yuklash xatosi' });
      }
      next();
    });
  },
  async (req, res) => {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
    }
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Noto‘g‘ri ID' });
    }

    try {
      const { rows } = await pool.query('SELECT * FROM drivers WHERE id = $1', [id]);
      if (!rows.length) {
        return res.status(404).json({ message: 'Topilmadi' });
      }
      const row = rows[0];
      if (row.is_banned === true) {
        return res.status(403).json({
          message: 'Akkaunt bloklangan. Qo‘llab-quvvatlash yoki admin bilan bog‘laning.',
        });
      }

      const originPlace = String(req.body.originPlace ?? row.origin_place ?? '').trim();

      let avatar_url = row.avatar_url;
      let car_photo_url = row.car_photo_url;

      if (req.files?.avatar?.[0]) {
        unlinkFile(avatar_url);
        avatar_url = req.files.avatar[0].filename;
      }
      if (req.files?.carPhoto?.[0]) {
        unlinkFile(car_photo_url);
        car_photo_url = req.files.carPhoto[0].filename;
      }

      await pool.query(
        `UPDATE drivers SET origin_place = $1, avatar_url = $2, car_photo_url = $3 WHERE id = $4`,
        [originPlace || null, avatar_url || null, car_photo_url || null, id],
      );

      const updated = await pool.query(
        `SELECT d.*, mg.name AS group_name FROM drivers d
         LEFT JOIN moderator_groups mg ON mg.id = d.group_id WHERE d.id = $1`,
        [id],
      );
      res.json(driverRowToJson(updated.rows[0]));
    } catch (err) {
      console.error('PATCH /api/drivers/:id', err);
      res.status(500).json({ message: 'Saqlashda xatolik' });
    }
  },
);

/** Haydovchi akkauntini o‘chirish */
app.delete('/api/drivers/:id', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
  }
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Noto‘g‘ri ID' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT avatar_url, car_photo_url FROM drivers WHERE id = $1',
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Topilmadi' });
    }
    unlinkFile(rows[0].avatar_url);
    unlinkFile(rows[0].car_photo_url);
    await pool.query('DELETE FROM drivers WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/drivers/:id', err);
    res.status(500).json({ message: 'O‘chirishda xatolik' });
  }
});

/**
 * Mijoz buyurtmasi (local yoki interregional).
 * interregional: to_district_id NULL = shahar/viloyat markazi; qidiruvda tumansiz filter → shu to_region dagi hamma variant.
 */
app.post('/api/ride-requests', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
  }
  const body = req.body || {};
  const orderKind = String(body.orderKind || '').trim();
  if (orderKind !== 'local' && orderKind !== 'interregional') {
    return res.status(400).json({ message: 'orderKind: local yoki interregional bo‘lishi kerak.' });
  }

  const fromPlace = body.fromPlace != null ? String(body.fromPlace).trim() || null : null;
  const toPlace = body.toPlace != null ? String(body.toPlace).trim() || null : null;
  const pickupLat =
    body.pickupLat != null && body.pickupLat !== '' ? Number(body.pickupLat) : null;
  const pickupLng =
    body.pickupLng != null && body.pickupLng !== '' ? Number(body.pickupLng) : null;
  const fromLabel = body.fromLabel != null ? String(body.fromLabel).trim() || null : null;
  const toLabel = body.toLabel != null ? String(body.toLabel).trim() || null : null;
  const phone = body.phone != null ? String(body.phone).trim() || null : null;
  const telegram = body.telegram != null ? String(body.telegram).trim() || null : null;
  const price = body.price != null ? String(body.price).trim() || null : null;
  const when = body.when != null ? String(body.when).trim() || null : null;
  const idTelegram = body.id_telegram != null ? body.id_telegram : null;

  const passengerNotes =
    body.passengerNotes != null ? String(body.passengerNotes).trim() || null : null;
  const passengerCount = Math.min(
    20,
    Math.max(1, Math.round(Number(body.passengerCount) || 1)),
  );

  let fromRegionId = body.fromRegionId != null ? parseInt(body.fromRegionId, 10) : null;
  let fromDistrictId = body.fromDistrictId != null ? parseInt(body.fromDistrictId, 10) : null;
  let toRegionId = body.toRegionId != null ? parseInt(body.toRegionId, 10) : null;
  let toDistrictId =
    body.toDistrictId != null && body.toDistrictId !== ''
      ? parseInt(body.toDistrictId, 10)
      : null;

  if (orderKind === 'interregional') {
    if ([fromRegionId, fromDistrictId, toRegionId].some((x) => Number.isNaN(x) || x == null)) {
      return res.status(400).json({
        message: 'interregional: fromRegionId, fromDistrictId, toRegionId majburiy.',
      });
    }
    if (toDistrictId != null && Number.isNaN(toDistrictId)) {
      return res.status(400).json({ message: 'Noto‘g‘ri toDistrictId.' });
    }
    const okFrom = await assertDistrictInRegion(pool, fromDistrictId, fromRegionId);
    if (!okFrom) {
      return res.status(400).json({ message: 'fromDistrictId ushbu fromRegionId ga tegishli emas.' });
    }
    if (toDistrictId != null) {
      const okTo = await assertDistrictInRegion(pool, toDistrictId, toRegionId);
      if (!okTo) {
        return res.status(400).json({ message: 'toDistrictId ushbu toRegionId ga tegishli emas.' });
      }
    }
  } else {
    fromRegionId = null;
    fromDistrictId = null;
    toRegionId = null;
    toDistrictId = null;
    if (
      !(toPlace && toPlace.length > 0) &&
      (pickupLat == null || pickupLng == null || Number.isNaN(pickupLat) || Number.isNaN(pickupLng))
    ) {
      return res.status(400).json({
        message: 'local: kamida toPlace yoki pickupLat/pickupLng kiriting.',
      });
    }
  }

  try {
    const ins = await pool.query(
      `INSERT INTO ride_requests (
        order_kind, status, phone, telegram, from_place, to_place, pickup_lat, pickup_lng,
        from_region_id, from_district_id, to_region_id, to_district_id,
        from_label, to_label, price, "when", passenger_count, passenger_notes, id_telegram
      ) VALUES ($1,'open',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        orderKind,
        phone,
        telegram,
        fromPlace,
        toPlace,
        pickupLat,
        pickupLng,
        fromRegionId,
        fromDistrictId,
        toRegionId,
        toDistrictId,
        fromLabel,
        toLabel,
        price,
        when,
        passengerCount,
        passengerNotes,
        idTelegram
      ],
    );
    res.status(201).json(rideRequestRowToJson(ins.rows[0]));
  } catch (err) {
    console.error('POST /api/ride-requests', err);
    res.status(500).json({ message: 'Buyurtmani saqlab bo‘lmadi.' });
  }
});

/**
 * Qidiruv: interregional uchun fromRegionId, fromDistrictId, toRegionId majburiy.
 * toDistrictId berilmasa — shu to_region ichidagi barcha ochiq buyurtmalar (tuman + markaz).
 * toDistrictId berilsa — markaz (NULL) yoki aynan shu tuman.
 */
app.get('/api/ride-requests', async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ message: 'Ma’lumotlar bazasi mavjud emas.' });
  }
  const fr = req.query.fromRegionId != null ? parseInt(req.query.fromRegionId, 10) : null;
  const fd = req.query.fromDistrictId != null ? parseInt(req.query.fromDistrictId, 10) : null;
  const tr = req.query.toRegionId != null ? parseInt(req.query.toRegionId, 10) : null;
  const td =
    req.query.toDistrictId != null && req.query.toDistrictId !== ''
      ? parseInt(req.query.toDistrictId, 10)
      : null;
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));

  try {
    if (fr != null && fd != null && tr != null && !Number.isNaN(fr) && !Number.isNaN(fd) && !Number.isNaN(tr)) {
      if (Number.isNaN(td) && req.query.toDistrictId != null && req.query.toDistrictId !== '') {
        return res.status(400).json({ message: 'Noto‘g‘ri toDistrictId.' });
      }
      const tdParam = td != null && !Number.isNaN(td) ? td : null;
      const { rows } = await pool.query(
        `SELECT * FROM ride_requests
         WHERE order_kind = 'interregional' AND status = 'open'
           AND from_region_id = $1 AND from_district_id = $2 AND to_region_id = $3
           AND ($4::INT IS NULL OR to_district_id IS NULL OR to_district_id = $4)
         ORDER BY created_at DESC
         LIMIT $5`,
        [fr, fd, tr, tdParam, limit],
      );
      return res.json(rows.map(rideRequestRowToJson));
    }

    const orderKind = req.query.orderKind ? String(req.query.orderKind).trim() : null;
    if (orderKind === 'local' || orderKind === 'interregional') {
      const { rows } = await pool.query(
        `SELECT * FROM ride_requests
         WHERE status = 'open' AND order_kind = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [orderKind, limit],
      );
      return res.json(rows.map(rideRequestRowToJson));
    }

    const { rows } = await pool.query(
      `SELECT * FROM ride_requests WHERE status = 'open' ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    res.json(rows.map(rideRequestRowToJson));
  } catch (err) {
    console.error('GET /api/ride-requests', err);
    res.status(500).json({ message: 'Ro‘yxatni olishda xatolik.' });
  }
});

/** Xarita uchun barcha aktiv buyurtmalarni olish (so'nggi 30 daqiqa) */
app.get('/api/map/ride-requests', async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json([]);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ride_requests 
       WHERE status = 'open' 
       AND last_seen_at > NOW() - INTERVAL '30 minutes'
       ORDER BY last_seen_at DESC
       LIMIT 200`
    );
    res.json(rows.map(rideRequestRowToJson));
  } catch (err) {
    console.error('GET /api/map/ride-requests', err);
    res.json([]);
  }
});

// --- Public API: Shikoyat yuborish ---
app.post('/api/complaints', async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(503).json({ message: 'Ma`lumotlar bazasi mavjud emas.' });
  const { driverId, phone, complaintText, fromWho } = req.body || {};
  if (!complaintText || !complaintText.trim()) {
    return res.status(400).json({ message: 'E`tiroz matni bo`sh bo`lishi mumkin emas' });
  }
  const dId = driverId ? parseInt(driverId, 10) : null;
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO complaints (driver_id, phone, complaint_text, from_who) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dId, phone || '', complaintText.trim(), fromWho || 'passenger']
    );
    res.json({ success: true, complaint: rows[0] });
  } catch (err) {
    console.error('POST /api/complaints', err);
    res.status(500).json({ message: 'Shikoyatni saqlashda xato yuz berdi.' });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('👤 Saytga yangi foydalanuvchi kirdi: ' + socket.id);

  socket.on('update_location', (data) => {
    console.log(`📍 Lokatsiya keldi [${socket.id}] [${data.role}]:`, data);
    const payload = {
      id: socket.id,
      lat: data.lat,
      lng: data.lng,
      role: data.role,
    };
    if (data.order && typeof data.order === 'object') {
      payload.order = data.order;
    }
    if (data.driverService && typeof data.driverService === 'object') {
      payload.driverService = data.driverService;
    }
    if (data.acceptingClients !== undefined) {
      payload.acceptingClients = data.acceptingClients;
    }
    payload.lastSeenAt = new Date().toISOString();
    socket.broadcast.emit('user_moved', payload);

    // Bazada vaqtini yangilash
    const pool = getPool();
    if (pool) {
      if (data.role === 'driver' && data.driverId) {
        pool.query('UPDATE drivers SET last_seen_at = NOW() WHERE id = $1', [data.driverId]).catch(() => {});
      } else if (data.role === 'client' && data.rideRequestId) {
        pool.query('UPDATE ride_requests SET last_seen_at = NOW(), pickup_lat = $1, pickup_lng = $2 WHERE id = $3', [data.lat, data.lng, data.rideRequestId]).catch(() => {});
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Foydalanuvchi chiqib ketdi: ' + socket.id);
  });
});

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

(async () => {
  await initSchema();
  server
    .listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Backend server ${PORT}-portda ishga tushdi (tarmoqdan kirish: 0.0.0.0).`);
      console.log(`   Admin API: http://127.0.0.1:${PORT}/api/admin (tekshiruv: JSON da "adminApi": true)`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const alt = PORT + 1;
        console.error(
          `❌ Port ${PORT} band. Boshqa port: PORT=${alt} npm start (frontend .env: VITE_API_URL=http://localhost:${alt})`,
        );
      } else {
        console.error(err);
      }
      process.exit(1);
    });
})();
