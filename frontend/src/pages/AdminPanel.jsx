import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getAdminToken, setAdminToken } from '../adminApi';

/** 404 = odatda 5001 da taxi-free backend yo‘q yoki boshqa jarayon */
function adminFetchErrorText(status, bodyMessage) {
  if (status === 404) {
    return 'Backend topilmadi (404). `cd backend && npm start` qiling. Brauzerda http://localhost:5001/api/admin oching — «adminApi»: true chiqishi kerak. Boshqa dastur 5001 ni band qilmasin.';
  }
  return bodyMessage || `So‘rov xatosi (${status}).`;
}

function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [breakpoint]);
  return narrow;
}

const TABS = [
  { id: 'stats', label: 'Statistika' },
  { id: 'drivers', label: 'Haydovchilar' },
  { id: 'groups', label: 'Haydovchi guruhlari' },
  { id: 'complaints', label: 'E`tirozlar' },
  { id: 'team', label: 'Jamoa', superOnly: true },
];

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [modEmail, setModEmail] = useState('');
  const [modPassword, setModPassword] = useState('');
  const [modName, setModName] = useState('');
  const [users, setUsers] = useState([]);

  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [driversBannedOnly, setDriversBannedOnly] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [banReasonByDriver, setBanReasonByDriver] = useState({});
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionMsg, setSectionMsg] = useState('');
  const isNarrow = useIsNarrow(640);
  const loadGroupsSeq = useRef(0);

  useEffect(() => {
    document.body.classList.add('admin-route');
    const root = document.getElementById('root');
    if (root) root.classList.add('admin-route-root');
    return () => {
      document.body.classList.remove('admin-route');
      root?.classList.remove('admin-route-root');
    };
  }, []);

  const loadMe = useCallback(async () => {
    const r = await adminApi('/api/admin/me');
    if (r.ok) {
      setUser(await r.json());
      return true;
    }
    setAdminToken(null);
    setUser(null);
    return false;
  }, []);

  const loadUsers = useCallback(async () => {
    const r = await adminApi('/api/admin/users');
    if (r.ok) setUsers(await r.json());
  }, []);

  const loadStats = useCallback(async () => {
    const r = await adminApi('/api/admin/stats');
    if (r.ok) {
      setStats(await r.json());
      return;
    }
    const err = await r.json().catch(() => ({}));
    setSectionMsg(adminFetchErrorText(r.status, err.message));
  }, []);

  const loadDrivers = useCallback(async () => {
    const q = driversBannedOnly ? '?banned=1' : '';
    const r = await adminApi(`/api/admin/drivers${q}`);
    if (r.ok) {
      setDrivers(await r.json());
      return;
    }
    const err = await r.json().catch(() => ({}));
    setSectionMsg(adminFetchErrorText(r.status, err.message));
  }, [driversBannedOnly]);

  const loadComplaints = useCallback(async () => {
    const r = await adminApi('/api/admin/complaints');
    if (r.ok) setComplaints(await r.json());
    else setSectionMsg('E\'tirozlarni yuklab bo\'lmadi.');
  }, []);

  const loadGroups = useCallback(async () => {
    const seq = ++loadGroupsSeq.current;
    const r = await adminApi('/api/admin/groups');
    if (seq !== loadGroupsSeq.current) return;
    if (r.ok) {
      const data = await r.json();
      setGroups(Array.isArray(data) ? data : []);
      return;
    }
    const err = await r.json().catch(() => ({}));
    setSectionMsg(adminFetchErrorText(r.status, err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getAdminToken()) {
        await loadMe();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadUsers();
    }
  }, [user, loadUsers]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setSectionLoading(true);
      setSectionMsg('');
      try {
        if (tab === 'stats') await loadStats();
        else if (tab === 'drivers') {
          await loadDrivers();
          if (user.role === 'super_admin') await loadGroups();
        } else if (tab === 'groups') await loadGroups();
        else if (tab === 'complaints') await loadComplaints();
      } finally {
        if (!cancelled) setSectionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tab, loadStats, loadDrivers, loadGroups, driversBannedOnly, loadComplaints]);

  useEffect(() => {
    if (user?.role === 'moderator' && tab === 'team') {
      setTab('stats');
    }
  }, [user, tab]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    const r = await adminApi('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || `Xato ${r.status}`);
      return;
    }
    setAdminToken(j.token);
    setUser(j.user);
  }

  async function handleCreateModerator(e) {
    e.preventDefault();
    setError('');
    const r = await adminApi('/api/admin/users/moderator', {
      method: 'POST',
      body: JSON.stringify({
        email: modEmail,
        password: modPassword,
        displayName: modName.trim() || 'Moderator',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || 'Moderator yaratilmadi');
      return;
    }
    setModEmail('');
    setModPassword('');
    setModName('');
    loadUsers();
    loadGroups();
  }

  async function handleModeratorSetActive(adminRow, isActive) {
    setError('');
    const r = await adminApi(`/api/admin/users/${adminRow.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || 'Saqlanmadi');
      return;
    }
    await loadUsers();
  }

  async function handleDeleteModerator(adminRow) {
    if (
      !window.confirm(
        `${adminRow.email} o‘chirilsinmi? Moderator bazadan butunlay yo‘qoladi (guruh bog‘lari ham).`,
      )
    ) {
      return;
    }
    setError('');
    const r = await adminApi(`/api/admin/users/${adminRow.id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || 'O‘chirilmadi');
      return;
    }
    await loadUsers();
    await loadGroups();
  }

  async function handleModeratorLeaveAllGroups(adminRow) {
    if (!window.confirm('Moderator barcha guruhlardan chiqarilsinmi?')) return;
    setError('');
    const r = await adminApi(`/api/admin/users/${adminRow.id}/leave-groups`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.message || 'Bajarilmadi');
      return;
    }
    await loadUsers();
    await loadGroups();
  }

  function handleLogout() {
    setAdminToken(null);
    setUser(null);
    setUsers([]);
    setStats(null);
    setDrivers([]);
    setGroups([]);
  }

  async function handleDriverBan(driverId, banned) {
    setSectionMsg('');
    const reason = banned ? (banReasonByDriver[driverId] || '').trim() || null : null;
    const r = await adminApi(`/api/admin/drivers/${driverId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned, reason }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSectionMsg(j.message || 'Ban amalga oshmadi');
      return;
    }
    await loadDrivers();
    if (banned) {
      setBanReasonByDriver((prev) => {
        const n = { ...prev };
        delete n[driverId];
        return n;
      });
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    setSectionMsg('');
    const trimmedName = groupName.trim();
    if (!trimmedName.length) {
      setSectionMsg('Guruh nomini kiriting.');
      return;
    }
    const r = await adminApi('/api/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name: trimmedName, description: groupDesc.trim() }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      setSectionMsg(
        r.status === 404
          ? adminFetchErrorText(404)
          : (j && j.message) || adminFetchErrorText(r.status, 'Guruh yaratilmadi.'),
      );
      return;
    }
    setGroupName('');
    setGroupDesc('');
    const newId = j != null ? Number(j.id) : NaN;
    if (Number.isFinite(newId)) {
      setGroups((prev) => {
        if (prev.some((g) => Number(g.id) === newId)) return prev;
        return [...prev, j].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || Number(a.id) - Number(b.id));
      });
    }
    setSectionMsg(`«${j?.name || trimmedName}» guruhi yaratildi.`);
    await loadGroups();
  }

  async function handleDriverGroupChange(driverId, groupIdStr) {
    setSectionMsg('');
    const body =
      groupIdStr === '' || groupIdStr == null
        ? { groupId: null }
        : { groupId: parseInt(groupIdStr, 10) };
    const r = await adminApi(`/api/admin/drivers/${driverId}/group`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const err = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSectionMsg(err.message || 'Guruh biriktirilmadi');
      return;
    }
    await loadDrivers();
    await loadGroups();
  }

  async function handleDeleteGroup(groupId) {
    if (!window.confirm('Guruh va uning moderator a’zolari bog‘lanishi o‘chadi. Davom etasizmi?')) return;
    setSectionMsg('');
    const r = await adminApi(`/api/admin/groups/${groupId}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSectionMsg(j.message || 'O‘chirilmadi');
      return;
    }
    await loadGroups();
  }

  async function handleAddGroupMember(groupId, adminUserId) {
    setSectionMsg('');
    const r = await adminApi(`/api/admin/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ adminUserId }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSectionMsg(j.message || 'Qo‘shilmadi');
      return;
    }
    await loadGroups();
    await loadUsers();
  }

  async function handleRemoveGroupMember(groupId, adminUserId) {
    setSectionMsg('');
    const r = await adminApi(`/api/admin/groups/${groupId}/members/${adminUserId}`, {
      method: 'DELETE',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setSectionMsg(j.message || 'Olib tashlanmadi');
      return;
    }
    await loadGroups();
    await loadUsers();
  }

  if (loading) {
    return (
      <div className="admin-panel" style={{ color: '#94a3b8' }}>
        Yuklanmoqda…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-panel admin-panel__login">
        <p style={{ marginBottom: 16 }}>
          <Link to="/" style={{ color: '#94a3b8', fontSize: 14 }}>
            ← Asosiy ilova
          </Link>
        </p>
        <h1 style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>Taxi Free — admin</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          Email va parolni kiriting.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            autoComplete="username"
            placeholder="Login"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Parol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error ? (
            <p style={{ margin: 0, color: '#f87171', fontSize: 13 }}>{error}</p>
          ) : null}
          <button type="submit" style={{ ...btnPrimary, width: '100%' }} className="admin-panel-touch-target">
            Kirish
          </button>
        </form>
      </div>
    );
  }

  const isSuper = user.role === 'super_admin';
  const moderatorsForGroups = users.filter((u) => u.role === 'moderator' && u.isActive !== false);
  const visibleTabs = TABS.filter((t) => !t.superOnly || isSuper);

  return (
    <div className="admin-panel">
      <header className="admin-panel__header">
        <h1 style={{ fontSize: 'clamp(1rem, 4vw, 1.15rem)', margin: 0, lineHeight: 1.3 }}>Admin panel</h1>
        <div className="admin-panel__header-actions">
          <Link
            to="/"
            style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            className="admin-panel-touch-target"
          >
            Asosiy ilova
          </Link>
          <button type="button" onClick={handleLogout} style={btnGhost} className="admin-panel-touch-target">
            Chiqish
          </button>
        </div>
      </header>

      <div style={card}>
        <p style={{ margin: '0 0 8px', color: '#94a3b8', fontSize: 13 }}>Siz</p>
        <p style={{ margin: 0, fontWeight: 700 }}>
          {user.displayName}{' '}
          <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>({user.email})</span>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>
          Rol:{' '}
          <strong style={{ color: isSuper ? '#fbbf24' : '#94a3b8' }}>
            {isSuper ? 'Super admin' : 'Moderator'}
          </strong>
          {!isSuper ? (
            <span className="admin-panel__role-note" style={{ color: '#64748b' }}>
              Guruhlar va haydovchilar — ko‘rish; ban va guruh boshqaruvi — super admin.
            </span>
          ) : null}
        </p>
      </div>

      <nav className="admin-panel__tabs" aria-label="Admin bo‘limlari">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="admin-panel__tab"
            style={{
              ...btnGhost,
              borderColor: tab === t.id ? '#fbbf24' : '#475569',
              color: tab === t.id ? '#fbbf24' : '#e2e8f0',
              fontWeight: tab === t.id ? 700 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {sectionMsg ? (
        <p style={{ color: '#fdba74', fontSize: 13, marginBottom: 12 }}>{sectionMsg}</p>
      ) : null}
      {sectionLoading ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Yuklanmoqda…</p>
      ) : null}

      {tab === 'stats' && stats ? (
        <div className="admin-panel__stats">
          <StatCard label="Super adminlar" value={stats.super_admins} />
          <StatCard label="Moderatorlar" value={stats.moderators} />
          <StatCard label="O‘chiq adminlar" value={stats.admins_inactive} accent="#94a3b8" />
          <StatCard label="Haydovchi guruhlari" value={stats.groups} />
          <StatCard label="Haydovchilar" value={stats.drivers} />
          <StatCard label="Bloklangan haydovchi" value={stats.drivers_banned} accent="#f87171" />
          <StatCard label="Buyurtmalar (jami)" value={stats.ride_requests_total} />
          <StatCard label="Ochiq buyurtmalar" value={stats.ride_open} accent="#86efac" />
          <StatCard label="Bog‘langan" value={stats.ride_matched} />
          <StatCard label="Bekor qilingan" value={stats.ride_cancelled} />
          <StatCard label="So‘nggi 24 soat" value={stats.rides_24h} accent="#38bdf8" />
          <StatCard label="So‘nggi 7 kun" value={stats.rides_7d} accent="#38bdf8" />
        </div>
      ) : null}

      {tab === 'stats' && !stats && !sectionLoading ? (
        <p style={{ color: '#94a3b8' }}>Statistikani yuklab bo‘lmadi.</p>
      ) : null}

      {tab === 'drivers' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <label
              style={{
                color: '#cbd5e1',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={driversBannedOnly}
                onChange={(e) => setDriversBannedOnly(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Faqat bloklanganlar
            </label>
          </div>
          {isNarrow ? (
            <div className="admin-panel__driver-cards">
              {drivers.map((d) => (
                <div key={d.id} className="admin-panel__driver-card">
                  <div style={{ fontWeight: 700 }}>
                    #{d.id} — {d.fullName || '—'}
                  </div>
                  <div className="admin-panel__driver-card-row">
                    <span>Telefon</span>
                    <span style={{ color: '#f8fafc' }}>{d.phone || '—'}</span>
                  </div>
                  <div className="admin-panel__driver-card-row">
                    <span>Avto</span>
                    <span style={{ color: '#fff', textAlign: 'right', fontWeight: 600 }}>
                      {d.carModel} {d.carNumber ? `· ${d.carNumber}` : ''}
                    </span>
                  </div>
                  <div className="admin-panel__driver-card-row">
                    <span>Holat</span>
                    <span>
                      {d.isBanned ? (
                        <span style={{ color: '#f87171' }}>
                          Blok{d.banReason ? ` — ${d.banReason}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#86efac' }}>Faol</span>
                      )}
                    </span>
                  </div>
                  {isSuper ? (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                        Haydovchi guruhi
                      </label>
                      <select
                        value={d.groupId ?? ''}
                        onChange={(e) => handleDriverGroupChange(d.id, e.target.value)}
                        style={{ ...inputStyle, width: '100%', padding: '10px 12px', fontSize: 14 }}
                      >
                        <option value="">— Guruh tanlanmagan —</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : d.groupName ? (
                    <div className="admin-panel__driver-card-row">
                      <span>Guruh</span>
                      <span style={{ color: '#f8fafc' }}>{d.groupName}</span>
                    </div>
                  ) : null}
                  {isSuper ? (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {d.isBanned ? (
                        <button
                          type="button"
                          style={{ ...btnSmall, borderColor: '#86efac', color: '#86efac', minHeight: 44 }}
                          onClick={() => handleDriverBan(d.id, false)}
                        >
                          Blokdan chiqarish
                        </button>
                      ) : (
                        <>
                          <input
                            placeholder="Sabab (ixtiyoriy)"
                            value={banReasonByDriver[d.id] || ''}
                            onChange={(e) =>
                              setBanReasonByDriver((prev) => ({ ...prev, [d.id]: e.target.value }))
                            }
                            style={{ ...inputStyle, padding: '12px 12px', fontSize: 15 }}
                          />
                          <button
                            type="button"
                            style={{ ...btnSmall, borderColor: '#f87171', color: '#f87171', minHeight: 44 }}
                            onClick={() => handleDriverBan(d.id, true)}
                          >
                            Bloklash
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-panel__table-wrap">
              <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 13, color: '#f8fafc' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>Ism</th>
                    <th style={{ padding: '10px 8px' }}>Telefon</th>
                    <th style={{ padding: '10px 8px' }}>Avto</th>
                    <th style={{ padding: '10px 8px' }}>Guruh</th>
                    <th style={{ padding: '10px 8px' }}>Holat</th>
                    {isSuper ? <th style={{ padding: '10px 8px' }}>Amallar</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 8px' }}>{d.id}</td>
                      <td style={{ padding: '10px 8px' }}>{d.fullName || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>{d.phone || '—'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {d.carModel} {d.carNumber ? `· ${d.carNumber}` : ''}
                      </td>
                      <td style={{ padding: '10px 8px', minWidth: 160 }}>
                        {isSuper ? (
                          <select
                            value={d.groupId ?? ''}
                            onChange={(e) => handleDriverGroupChange(d.id, e.target.value)}
                            style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, width: '100%', maxWidth: 200 }}
                          >
                            <option value="">—</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{d.groupName || '—'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {d.isBanned ? (
                          <span style={{ color: '#f87171' }}>
                            Blok
                            {d.banReason ? ` — ${d.banReason}` : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#86efac' }}>Faol</span>
                        )}
                      </td>
                      {isSuper ? (
                        <td style={{ padding: '10px 8px', verticalAlign: 'top' }}>
                          {d.isBanned ? (
                            <button
                              type="button"
                              style={{ ...btnSmall, borderColor: '#86efac', color: '#86efac' }}
                              onClick={() => handleDriverBan(d.id, false)}
                            >
                              Blokdan chiqarish
                            </button>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 220 }}>
                              <input
                                placeholder="Sabab (ixtiyoriy)"
                                value={banReasonByDriver[d.id] || ''}
                                onChange={(e) =>
                                  setBanReasonByDriver((prev) => ({ ...prev, [d.id]: e.target.value }))
                                }
                                style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }}
                              />
                              <button
                                type="button"
                                style={{ ...btnSmall, borderColor: '#f87171', color: '#f87171' }}
                                onClick={() => handleDriverBan(d.id, true)}
                              >
                                Bloklash
                              </button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!drivers.length && !sectionLoading ? (
            <p style={{ color: '#64748b', marginTop: 12 }}>Haydovchilar yo‘q.</p>
          ) : null}
        </div>
      ) : null}

      
      {/* ── COMPLAINTS TAB ── */}
      {tab === 'complaints' && !sectionLoading ? (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {complaints.length === 0 && <p style={{ color: '#94a3b8' }}>E'tirozlar yo'q.</p>}
          {complaints.map(c => (
            <div key={c.id} style={{ ...card, borderLeft: c.is_resolved ? '4px solid #4ade80' : '4px solid #fbbf24', opacity: c.is_resolved ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.is_resolved ? '#4ade80' : '#fbbf24', marginBottom: 8, textTransform: 'uppercase' }}>
                    {c.is_resolved ? 'Hal qilingan' : 'Yangi e\'tiroz'}
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 15, color: '#f8fafc', lineHeight: 1.5 }}>"{c.complaint_text}"</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                    Shikoyatchi: <strong style={{color: '#fff'}}>{c.phone || "Noma'lum"}</strong> ({c.from_who === 'driver' ? 'Haydovchi' : 'Yo\'lovchi'})
                  </p>
                  {c.driver_id && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                    Kim ustidan: <strong style={{color: '#fff'}}>{c.driver_name} [{c.driver_car}]</strong> (ID: {c.driver_id})
                  </p>}
                </div>
                {!c.is_resolved && (
                  <button onClick={async () => {
                     const r = await adminApi(`/api/admin/complaints/${c.id}/resolve`, { method: 'POST' });
                     if(r.ok) {
                         setComplaints(prev => prev.map(old => old.id === c.id ? { ...old, is_resolved: true } : old));
                     }
                  }} style={{ ...btnSmall, borderColor: '#4ade80', color: '#4ade80' }} className="admin-panel-touch-target">
                    ✔ Belgilash
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

{tab === 'groups' ? (
        <div>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>
            {isSuper ? (
              <>
                <strong style={{ color: '#f8fafc' }}>Haydovchi guruhi</strong> — haydovchilarni boshqarish uchun
                cluster. <strong>«Haydovchilar»</strong> bo‘limida har bir haydovchini guruhga biriktiring;{' '}
                <strong>«Jamoa»</strong>da moderatorlarni shu guruhga qo‘shing — ular o‘z guruhlaridagi haydovchilar
                bilan ishlaydi.
              </>
            ) : (
              <>
                Sizga biriktirilgan <strong style={{ color: '#f8fafc' }}>haydovchi guruhlari</strong>. Har birida
                nechta haydovchi va moderator borligi ko‘rsatiladi.
              </>
            )}
          </p>
          {isSuper ? (
            <form onSubmit={handleCreateGroup} style={{ ...card, marginBottom: 20 }}>
              <h2 style={{ fontSize: '1rem', margin: '0 0 12px' }}>Yangi haydovchi guruhi</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
                <input
                  placeholder="Guruh nomi"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Tavsif (ixtiyoriy)"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  style={inputStyle}
                />
                <button type="submit" style={btnPrimary}>
                  Guruh yaratish
                </button>
              </div>
            </form>
          ) : null}

          <h2 style={{ fontSize: '1rem', margin: '20px 0 12px', color: '#f8fafc' }}>
            Mavjud guruhlar
            {!sectionLoading ? <span style={{ color: '#64748b', fontWeight: 500 }}> ({groups.length})</span> : null}
          </h2>

          {groups.length === 0 && !sectionLoading ? (
            <p style={{ color: '#64748b', marginBottom: 16 }}>
              {isSuper
                ? 'Hozircha guruh yo‘q. Yuqoridan yarating — keyin ro‘yxat shu yerda paydo bo‘ladi.'
                : 'Siz hozircha hech qaysi guruhga kiritilmagansiz.'}
            </p>
          ) : null}

          {groups.map((g) => (
            <div key={g.id} style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{g.name}</h3>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#86efac' }}>
                    Haydovchilar: <strong>{g.driverCount ?? 0}</strong>
                    <span style={{ color: '#64748b', margin: '0 8px' }}>·</span>
                    Moderatorlar: <strong>{g.members?.length ?? 0}</strong>
                  </p>
                  {g.description ? (
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>{g.description}</p>
                  ) : null}
                </div>
                {isSuper ? (
                  <button
                    type="button"
                    style={{ ...btnSmall, borderColor: '#f87171', color: '#fca5a5' }}
                    onClick={() => handleDeleteGroup(g.id)}
                  >
                    Guruhni o‘chirish
                  </button>
                ) : null}
              </div>
              <p style={{ margin: '12px 0 8px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Moderatorlar ({g.members?.length || 0})
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(g.members || []).map((m) => (
                  <li key={m.id} className="admin-panel__member-row">
                    <span style={{ wordBreak: 'break-word' }}>
                      <strong>{m.displayName}</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>{m.email}</span>{' '}
                      <span style={{ color: '#64748b' }}>({m.role})</span>
                    </span>
                    {isSuper ? (
                      <button
                        type="button"
                        style={{ ...btnSmall, minHeight: 44, alignSelf: 'stretch' }}
                        className="admin-panel-touch-target"
                        onClick={() => handleRemoveGroupMember(g.id, m.id)}
                      >
                        Olib tashlash
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {isSuper && moderatorsForGroups.length ? (
                <div className="admin-panel__group-add" style={{ marginTop: 12 }}>
                  <select
                    id={`add-mod-${g.id}`}
                    style={{ ...inputStyle, maxWidth: '100%', width: '100%', flex: '1 1 200px' }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Moderator qo‘shish…
                    </option>
                    {moderatorsForGroups.map((m) => {
                      const inGroup = (g.members || []).some((x) => x.id === m.id);
                      if (inGroup) return null;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.displayName} — {m.email}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    style={{ ...btnGhost, minHeight: 44 }}
                    className="admin-panel-touch-target"
                    onClick={() => {
                      const sel = document.getElementById(`add-mod-${g.id}`);
                      const v = sel && parseInt(sel.value, 10);
                      if (v) handleAddGroupMember(g.id, v);
                    }}
                  >
                    Qo‘shish
                  </button>
                </div>
              ) : null}
              {isSuper && !moderatorsForGroups.length ? (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#64748b' }}>
                  Avval «Jamoa» bo‘limida moderator yarating.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'team' && isSuper ? (
        <>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px' }}>Moderator qo‘shish</h2>
          <form onSubmit={handleCreateModerator} style={{ ...card, marginBottom: 20 }} className="admin-panel__mod-form">
            <input
              type="text"
              placeholder="Ko‘rinadigan ism (ixtiyoriy)"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              style={inputStyle}
              className="admin-panel__mod-form-name"
            />
            <div className="admin-panel__mod-form-row">
              <input
                type="email"
                placeholder="Login (email)"
                value={modEmail}
                onChange={(e) => setModEmail(e.target.value)}
                style={inputStyle}
                className="admin-panel__mod-input"
              />
              <input
                type="password"
                placeholder="Parol (≥8)"
                value={modPassword}
                onChange={(e) => setModPassword(e.target.value)}
                style={inputStyle}
                className="admin-panel__mod-input"
              />
              <button type="submit" style={btnPrimary} className="admin-panel__mod-submit admin-panel-touch-target">
                Moderator yaratish
              </button>
            </div>
          </form>

          <h2 style={{ fontSize: '1rem', margin: '24px 0 12px' }}>Barcha admin foydalanuvchilar</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {users.map((row) => {
              const isSelf = row.id === user.id;
              const isMod = row.role === 'moderator';
              const grp = Array.isArray(row.groups) ? row.groups : [];
              return (
                <li key={row.id} style={{ ...card, marginBottom: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div>
                      <strong>{row.displayName}</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>{row.email}</span>{' '}
                      <span style={{ color: '#64748b' }}>
                        ({row.role === 'super_admin' ? 'Super admin' : 'Moderator'})
                      </span>
                      {row.isActive === false ? (
                        <span style={{ color: '#f87171', marginLeft: 6 }}>— bloklangan</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    Guruhlar:
                    {grp.length ? (
                      <div className="admin-panel__user-groups">
                        {grp.map((g) => (
                          <span key={g.id} className="admin-panel__group-chip">
                            {g.name}
                            {isMod && !isSelf ? (
                              <button
                                type="button"
                                title={`${g.name} dan chiqarish`}
                                onClick={() => handleRemoveGroupMember(g.id, row.id)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: 14,
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ marginLeft: 6, color: '#475569' }}>biriktirilmagan</span>
                    )}
                  </div>
                  {isMod && !isSelf ? (
                    <div className="admin-panel__user-actions">
                      {row.isActive !== false ? (
                        <button
                          type="button"
                          style={{ ...btnSmall, borderColor: '#b45309', color: '#fdba74', minHeight: 40 }}
                          className="admin-panel-touch-target"
                          onClick={() => handleModeratorSetActive(row, false)}
                        >
                          Bloklash
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={{ ...btnSmall, borderColor: '#86efac', color: '#86efac', minHeight: 40 }}
                          className="admin-panel-touch-target"
                          onClick={() => handleModeratorSetActive(row, true)}
                        >
                          Blokdan chiqarish
                        </button>
                      )}
                      <button
                        type="button"
                        style={{ ...btnSmall, minHeight: 40 }}
                        className="admin-panel-touch-target"
                        onClick={() => handleModeratorLeaveAllGroups(row)}
                        disabled={!grp.length}
                      >
                        Barcha guruhlardan chiqarish
                      </button>
                      <button
                        type="button"
                        style={{ ...btnSmall, borderColor: '#f87171', color: '#fca5a5', minHeight: 40 }}
                        className="admin-panel-touch-target"
                        onClick={() => handleDeleteModerator(row)}
                      >
                        O‘chirish
                      </button>
                    </div>
                  ) : null}
                  {isSelf ? (
                    <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>Bu sizning akkauntingiz.</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {error ? <p style={{ color: '#f87171', fontSize: 13, marginTop: 16 }}>{error}</p> : null}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        ...card,
        margin: 0,
        borderColor: accent ? `${accent}55` : '#334155',
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.35 }}>{label}</p>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 'clamp(1.1rem, 4vw, 1.375rem)',
          fontWeight: 800,
          color: accent || '#f8fafc',
          lineHeight: 1.2,
        }}
      >
        {value ?? '—'}
      </p>
    </div>
  );
}

const inputStyle = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: 15,
};

const btnPrimary = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(180deg, #fde68a, #f59e0b)',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
};

const btnGhost = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #475569',
  background: 'transparent',
  color: '#f8fafc',
  cursor: 'pointer',
  fontSize: 13,
};

const btnSmall = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #475569',
  background: 'transparent',
  color: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};

const card = {
  padding: 16,
  borderRadius: 12,
  background: '#1e293b',
  border: '1px solid #334155',
};
