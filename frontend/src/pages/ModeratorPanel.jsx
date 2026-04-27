import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getAdminToken, setAdminToken } from '../adminApi';

/* ─── Yordamchi funksiyalar ───────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return iso; }
}

function daysLeft(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - new Date();
  return Math.ceil(diff / 86_400_000);
}

function isNewcomer(iso) {
  if (!iso) return false;
  const diff = new Date() - new Date(iso);
  return diff <= 7 * 86_400_000; // 7 kun
}

function PayBadge({ status, expiresAt }) {
  const days = daysLeft(expiresAt);
  if (status === 'paid') {
    const urgent = days !== null && days <= 7;
    return (
      <span style={{
        ...badge,
        background: urgent ? 'rgba(251,191,36,0.15)' : 'rgba(134,239,172,0.15)',
        border: `1px solid ${urgent ? '#f59e0b' : '#4ade80'}`,
        color: urgent ? '#fbbf24' : '#86efac',
      }}>
        {urgent ? `⚠️ ${days}k qoldi` : `✅ To'langan`}
      </span>
    );
  }
  if (status === 'expired') {
    return <span style={{ ...badge, background: 'rgba(248,113,113,0.15)', border: '1px solid #ef4444', color: '#f87171' }}>🔴 Muddati o'tgan</span>;
  }
  return <span style={{ ...badge, background: 'rgba(100,116,139,0.2)', border: '1px solid #475569', color: '#94a3b8' }}>⚪ To'lanmagan</span>;
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card" style={{...statCard, position: 'relative', overflow: 'hidden'}}>
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 80, opacity: 0.05 }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 24, padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>{icon}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      </div>
      <div style={{ fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', fontWeight: 800, color: color || '#f8fafc', lineHeight: 1 }}>{value ?? '—'}</div>
    </div>
  );
}

/* ─── Asosiy komponent ────────────────────────────────────── */
export default function ModeratorPanel() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [tab, setTab] = useState('stats'); // stats | drivers | new | complaints
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  
  const [filterStatus, setFilterStatus] = useState('all'); 
  const [searchQ, setSearchQ] = useState('');
  const [sectionLoading, setSectionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Modallar
  const [payModal, setPayModal] = useState(null); // { driver }
  const [payStatus, setPayStatus] = useState('paid');
  const [payMonths, setPayMonths] = useState(1);
  const [payNote, setPayNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const [banModal, setBanModal] = useState(null); // { driver }
  const [banReason, setBanReason] = useState('');

  /* ── Admin route class ── */
  useEffect(() => {
    document.body.classList.add('admin-route');
    const root = document.getElementById('root');
    if (root) root.classList.add('admin-route-root');
    return () => {
      document.body.classList.remove('admin-route');
      root?.classList.remove('admin-route-root');
    };
  }, []);

  /* ── Auth ── */
  const loadMe = useCallback(async () => {
    const r = await adminApi('/api/admin/me');
    if (r.ok) { setUser(await r.json()); return true; }
    setAdminToken(null); setUser(null); return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (getAdminToken()) await loadMe();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadMe]);

  async function handleLogin(e) {
    e.preventDefault(); setLoginError('');
    const r = await adminApi('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setLoginError(j.message || `Xato ${r.status}`); return; }
    setAdminToken(j.token); setUser(j.user);
  }

  function handleLogout() {
    setAdminToken(null); setUser(null); setStats(null); setDrivers([]); setComplaints([]);
  }

  /* ── Ma'lumot yuklash ── */
  const loadStats = useCallback(async () => {
    const r = await adminApi('/api/admin/stats');
    if (r.ok) setStats(await r.json());
  }, []);

  const loadDrivers = useCallback(async () => {
    const r = await adminApi('/api/admin/drivers?limit=1000');
    if (r.ok) setDrivers(await r.json());
  }, []);

  const loadComplaints = useCallback(async () => {
    const r = await adminApi('/api/admin/complaints');
    if (r.ok) setComplaints(await r.json());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setSectionLoading(true); setMsg('');
      try {
        if (tab === 'stats') { await loadStats(); await loadDrivers(); }
        else if (tab === 'drivers' || tab === 'new') await loadDrivers();
        else if (tab === 'complaints') await loadComplaints();
      } finally { if (!cancelled) setSectionLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user, tab, loadStats, loadDrivers, loadComplaints]);

  /* ── To'lov holati o'zgartirish ── */
  async function handlePaySubmit(e) {
    e.preventDefault();
    if (!payModal) return;
    setPayLoading(true); setMsg('');
    const r = await adminApi(`/api/admin/drivers/${payModal.driver.id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ status: payStatus, months: payMonths, note: payNote }),
    });
    const j = await r.json().catch(() => ({}));
    setPayLoading(false);
    if (!r.ok) { alert(j.message || 'Xato!'); return; }
    setDrivers(prev => prev.map(d => d.id === j.id ? j : d));
    setPayModal(null);
  }

  /* ── Ban funksiyalari ── */
  async function toggleBan(driver) {
    if (driver.isBanned) {
      if (!window.confirm(`Blokdan chiqarilsinmi?`)) return;
      const r = await adminApi(`/api/admin/drivers/${driver.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ banned: false }),
      });
      if (r.ok) {
        const j = await r.json();
        setDrivers(prev => prev.map(d => d.id === j.id ? j : d));
      } else alert("Xatolik!");
    } else {
      setBanReason('');
      setBanModal({ driver });
    }
  }

  async function submitBan(e) {
    e.preventDefault();
    if(!banModal) return;
    const r = await adminApi(`/api/admin/drivers/${banModal.driver.id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned: true, reason: banReason }),
    });
    if (r.ok) {
      const j = await r.json();
      setDrivers(prev => prev.map(d => d.id === j.id ? j : d));
      setBanModal(null);
    } else alert("Xatolik!");
  }

  async function deleteDriver(id) {
    if (!window.confirm("Haqiqatdan ham haydovchini butunlay o'chirib yubormoqchimisiz? Bu amalni qaytarib bo'lmaydi!")) return;
    const r = await adminApi(`/api/admin/drivers/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setDrivers(prev => prev.filter(d => d.id !== id));
    } else {
      const j = await r.json().catch(()=>({}));
      alert(j.message || 'Xatolik');
    }
  }

  /* ── E'tiroz hal qilingan deb belgilash ── */
  async function resolveComplaint(id) {
    const r = await adminApi(`/api/admin/complaints/${id}/resolve`, { method: 'POST' });
    if(r.ok) {
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, is_resolved: true } : c));
    } else {
      alert("Xato yuz berdi");
    }
  }

  /* ── Filter ── */
  let currentList = drivers;
  if(tab === 'new') {
    currentList = drivers.filter(d => isNewcomer(d.createdAt));
  }
  
  const filteredList = currentList.filter(d => {
    const s = d.paymentStatus;
    if (filterStatus !== 'all' && s !== filterStatus) return false;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      return (
        d.fullName?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.carNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const driverStats = {
    total: drivers.length,
    paid: drivers.filter(d => d.paymentStatus === 'paid').length,
    unpaid: drivers.filter(d => d.paymentStatus === 'unpaid').length,
    expired: drivers.filter(d => d.paymentStatus === 'expired').length,
    expiringSoon: drivers.filter(d => {
      const n = daysLeft(d.paymentExpiresAt);
      return d.paymentStatus === 'paid' && n !== null && n <= 7;
    }).length,
    newcomers: drivers.filter(d => isNewcomer(d.createdAt)).length,
  };

  /* ─────────────────── RENDER ─────────────────── */
  if (loading) return <div style={pageWrap}><div style={{ color: '#64748b', padding: 40, textAlign:'center' }}>Yuklanmoqda…</div></div>;

  if (!user) {
    return (
      <div style={{ ...pageWrap, alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%)' }}>
        <div style={{...loginBox, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)'}}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚖</div>
            <h1 style={{ fontSize: '1.75rem', margin: '0 0 10px', color: '#f8fafc', fontWeight: 800 }}>Moderator Panel</h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Tizimga kirish</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" placeholder="Email manzil" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
            <input type="password" placeholder="Parol" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
            {loginError && <p style={{ margin: 0, color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>{loginError}</p>}
            <button type="submit" style={{...btnPrimary, padding: '14px', fontSize: 15, marginTop: 8}}>Kirish</button>
          </form>
        </div>
      </div>
    );
  }

  const isSuper = user.role === 'super_admin';
  const canEdit = isSuper || user.role === 'moderator';

  const TABS = [
    { id: 'stats', label: '📊 Bosh sahifa' },
    { id: 'links', label: '🔗 Havolalar' },
    { id: 'new', label: `🆕 Yangilar (${driverStats.newcomers})` },
    { id: 'drivers', label: '🚗 Haydovchilar' },
    { id: 'complaints', label: '📋 E\'tirozlar' },
  ];

  return (
    <div style={pageWrap}>
      {/* ── Header ── */}
      <header style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
            🚖
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 800 }}>Moderator</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
              {user.displayName} · <span style={{ color: isSuper ? '#fbbf24' : '#38bdf8' }}>{isSuper ? 'Super admin' : 'Moderator'}</span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/admin" style={{ ...btnGhost, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>🔧 Panel</Link>
          <button type="button" onClick={handleLogout} style={btnGhost}>🚪 Chiqish</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={tabsContainer}>
        <div style={tabsBar}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{ ...tabBtn, ...(tab === t.id ? tabActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <main style={main}>
        {sectionLoading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Yuklanmoqda…</div>}

        {/* ── STATS TAB ── */}
        {tab === 'stats' && !sectionLoading && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={sectionTitle}>Umumiy statistika</h2>
            <div style={statsGrid}>
              <StatCard icon="👥" label="Haydovchilar" value={driverStats.total} color="#f8fafc" />
              <StatCard icon="✅" label="To'lagan" value={driverStats.paid} color="#4ade80" />
              <StatCard icon="⚪" label="To'lamagan" value={driverStats.unpaid} color="#94a3b8" />
              <StatCard icon="🔴" label="Muddati o'tgan" value={driverStats.expired} color="#f87171" />
              <StatCard icon="⚠️" label="Tugamoqda" value={driverStats.expiringSoon} color="#fbbf24" />
            </div>

            {drivers.filter(d => { const n = daysLeft(d.paymentExpiresAt); return d.paymentStatus === 'paid' && n !== null && n <= 10; }).length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h2 style={{...sectionTitle, display: 'flex', alignItems: 'center', gap: 8}}>⚠️ Yaqinda muddati tugaydiganlar (10 kun)</h2>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                  {drivers
                    .filter(d => { const n = daysLeft(d.paymentExpiresAt); return d.paymentStatus === 'paid' && n !== null && n <= 10; })
                    .sort((a, b) => daysLeft(a.paymentExpiresAt) - daysLeft(b.paymentExpiresAt))
                    .map(d => {
                      const days = daysLeft(d.paymentExpiresAt);
                      return (
                        <div key={d.id} className="card-hover" style={warningCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                               <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 16 }}>{d.fullName || '\u2014'} <span style={{fontSize: 12, color: '#64748b'}}>#{d.id}</span></div>
                               <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>📞 {d.phone}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                               <div style={{ fontSize: 20, fontWeight: 800, color: days <= 3 ? '#f87171' : '#fbbf24' }}>{days} kun</div>
                               <button type="button" style={{...btnSmall, marginTop: 4, borderColor: '#fbbf24', color: '#fbbf24'}} onClick={() => { setPayModal({ driver: d }); setPayStatus('paid'); setPayMonths(1); setPayNote(''); }}>
                                 Yangilash
                               </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            {drivers.filter(d => d.paymentStatus === 'expired').length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h2 style={{...sectionTitle, display: 'flex', alignItems: 'center', gap: 8}}>🔴 Muddati o'tganlar</h2>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                  {drivers.filter(d => d.paymentStatus === 'expired').map(d => (
                    <div key={d.id} className="card-hover" style={expiredCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                           <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 16 }}>{d.fullName || '\u2014'}</div>
                           <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>📞 {d.phone}</div>
                        </div>
                        <button type="button" style={{...btnSmall, borderColor: '#f87171', color: '#fca5a5'}} onClick={() => { setPayModal({ driver: d }); setPayStatus('paid'); setPayMonths(1); setPayNote(''); }}>
                           To'lash
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LINKS TAB ── */}
        {tab === 'links' && !sectionLoading && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={sectionTitle}>Taklif havolalari</h2>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {(!user.groups || user.groups.length === 0) && (
                <div style={{ background: '#1e293b', padding: 32, borderRadius: 16, textAlign: 'center', color: '#94a3b8' }}>
                  Sizga hali guruh biriktirilmagan.
                </div>
              )}
              {(user.groups || []).map(g => (
                <div key={g.id} style={statCard}>
                  <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: 18, marginBottom: 8 }}>{g.name}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                    Ushbu havola orqali roʻyxatdan oʻtgan haydovchilar avtomatik ravishda shu guruhga qoʻshiladi.
                  </div>
                  <div style={{ ...inp, padding: '10px 12px', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 12, background: '#0f172a' }}>
                    {g.inviteLink || 'Havola mavjud emas'}
                  </div>
                  {g.inviteLink && (
                    <button
                      type="button"
                      style={{ ...btnPrimary, width: '100%' }}
                      onClick={() => {
                        navigator.clipboard.writeText(g.inviteLink);
                        alert('Nusxa olindi!');
                      }}
                    >
                      Nusxa olish
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: 24, padding: 16, background: 'rgba(56,189,248,0.1)', border: '1px solid #38bdf840', borderRadius: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 24 }}>💡</div>
                <div style={{ fontSize: 14, color: '#7dd3fc', lineHeight: 1.5 }}>
                  <strong>Global haydovchilar:</strong> Agar haydovchi hech qanday taklif havolasisiz (oddiy bot orqali) 
                  roʻyxatdan oʻtsa, u hech qaysi moderatorga biriktirilmaydi va faqat Super Admin boshqaruvida boʻladi.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DRIVERS & NEW TAB ── */}
        {(tab === 'drivers' || tab === 'new') && !sectionLoading && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{...inp, flex: 1, display: 'flex', alignItems: 'center', padding: 0}}>
                <span style={{padding: '0 12px', color: '#64748b'}}>\uD83D\uDD0D</span>
                <input
                  placeholder="Ism, telefon raqami yoki avto raqam orqali qidiring..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', padding: '14px 14px 14px 0', outline: 'none' }}
                />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, minWidth: 160 }}>
                <option value="all">Barchasi ({currentList.length})</option>
                <option value="paid">✅ To'lagan</option>
                <option value="unpaid">⚪ To'lamagan</option>
                <option value="expired">🔴 Muddati o'tgan</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredList.length === 0 && <div style={{textAlign: 'center', color: '#475569', padding: '40px 0'}}>Hech kim topilmadi!</div>}
              {filteredList.map(d => {
                const days = daysLeft(d.paymentExpiresAt);
                const isUrgent = d.paymentStatus === 'paid' && days !== null && days <= 7;
                return (
                  <div key={d.id} className="driver-row" style={{
                    ...driverCard, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                    borderLeft: `4px solid ${d.paymentStatus === 'paid' ? (isUrgent ? '#fbbf24' : '#4ade80') : d.paymentStatus === 'expired' ? '#ef4444' : '#475569'}`,
                    opacity: d.isBanned ? 0.6 : 1
                  }}>
                    {/* Left Info */}
                    <div style={{ flex: '1 1 250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>{d.fullName || "Ismsiz"}</span>
                        {d.isBanned && <span style={{ ...badge, background: '#ef444420', color: '#fca5a5' }}>Blocklangan</span>}
                        {isNewcomer(d.createdAt) && <span style={{ ...badge, background: '#38bdf820', color: '#7dd3fc' }}>Yangi</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#cbd5e1' }}>
                        <span>📞 {d.phone || '\u2014'}</span>
                        <span>🚗 {d.carModel || '\u2014'} {d.carNumber ? `[${d.carNumber}]` : ''}</span>
                        {d.groupName && <span>👥 {d.groupName}</span>}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>A'zo bo'ldi: {fmtDate(d.createdAt)}</div>
                      {d.isBanned && d.banReason && <div style={{color: '#fca5a5', fontSize: 12, marginTop: 4, fontStyle: 'italic'}}>Sabab: {d.banReason}</div>}
                    </div>

                    {/* Right Payment & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                         <PayBadge status={d.paymentStatus} expiresAt={d.paymentExpiresAt} />
                         {canEdit && (
                            <button
                              type="button"
                              style={{ ...btnSmall, background: 'rgba(255,255,255,0.05)', borderColor: 'transparent' }}
                              onClick={() => {
                                setPayModal({ driver: d });
                                setPayStatus(d.paymentStatus === 'paid' ? 'unpaid' : 'paid');
                                setPayMonths(1); setPayNote('');
                              }}
                            >
                              💳 To'lov
                            </button>
                          )}
                      </div>
                      
                      {/* Boshqaruv */}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            type="button" 
                            style={{...btnSmall, borderColor: d.isBanned ? '#4ade80' : '#f87171', color: d.isBanned ? '#4ade80' : '#fca5a5'}}
                            onClick={() => toggleBan(d)}
                          >
                            {d.isBanned ? '✅ Ochish' : '🚫 Bloklash'}
                          </button>
                          {(isSuper || canEdit /* moderatorga da delete access qoshdik api da, ok */) && (
                            <button 
                              type="button" 
                              style={{...btnSmall, borderColor: '#b91c1c', color: '#ef4444', background: '#7f1d1d20'}}
                              onClick={() => deleteDriver(d.id)}
                            >
                              🗑️ O'chirish
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── E'TIROZLAR TABI ── */}
        {tab === 'complaints' && !sectionLoading && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h2 style={sectionTitle}>Kelib tushgan shikoyat va e'tirozlar</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               {complaints.length === 0 && <div style={{textAlign: 'center', color: '#475569', padding: '40px 0'}}>E'tirozlar yo'q</div>}
               {complaints.map(c => (
                 <div key={c.id} style={{
                   ...driverCard,
                   borderLeft: `4px solid ${c.is_resolved ? '#4ade80' : '#f59e0b'}`,
                   opacity: c.is_resolved ? 0.7 : 1
                 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div>
                       <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                         <span style={{ fontSize: 12, fontWeight: 700, color: c.is_resolved ? '#4ade80' : '#fbbf24', textTransform: 'uppercase' }}>
                           {c.is_resolved ? 'Hal qilingan' : 'Yangi shikoyat'}
                         </span>
                         <span style={{ fontSize: 12, color: '#64748b' }}>{fmtDateTime(c.created_at)}</span>
                       </div>
                       <p style={{ margin: '10px 0', fontSize: 15, color: '#f8fafc', lineHeight: 1.5 }}>"{c.complaint_text}"</p>
                       <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#cbd5e1' }}>
                         <span>👤 Shikoyatchi tel: <strong style={{color: '#fff'}}>{c.phone || "Noma'lum"}</strong> ({c.from_who === 'driver' ? 'Haydovchi' : 'Yo\'lovchi'})</span>
                         {c.driver_id && <span>🚗 Kim ustidan: <strong style={{color: '#fff'}}>{c.driver_name} [{c.driver_car}]</strong> (ID: {c.driver_id})</span>}
                       </div>
                     </div>
                     {!c.is_resolved && canEdit && (
                       <button onClick={() => resolveComplaint(c.id)} style={{...btnSmall, background: '#4ade8020', borderColor: '#4ade80', color: '#4ade80'}}>
                         ✔️ Beliglash
                       </button>
                     )}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {/* 1. Pay Modal */}
      {payModal && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setPayModal(null); }}>
          <div style={modalBox}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#f8fafc' }}>💳 To'lov holati</h2>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{payModal.driver.fullName || 'Ismsiz'}</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>ID: {payModal.driver.id} | Tel: {payModal.driver.phone}</div>
            </div>
            
            <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Holat</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" style={{ ...toggleBtn, ...(payStatus === 'paid' ? {background: '#4ade8020', borderColor: '#4ade80', color: '#4ade80'} : {}) }} onClick={() => setPayStatus('paid')}>
                    ✅ To'langanga o'zgartirish
                  </button>
                  <button type="button" style={{ ...toggleBtn, ...(payStatus === 'unpaid' ? {background: '#f8717120', borderColor: '#f87171', color: '#fca5a5'} : {}) }} onClick={() => setPayStatus('unpaid')}>
                    ⚪ To'lanmagan
                  </button>
                </div>
              </div>

              {payStatus === 'paid' && (
                <div>
                  <label style={label}>Obuna muddati (oy)</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {[1, 2, 3, 6, 12].map(m => (
                      <button key={m} type="button" style={{ ...monthBtn, ...(payMonths === m ? {background: '#fbbf2420', borderColor: '#fbbf24', color: '#fbbf24'} : {}) }} onClick={() => setPayMonths(m)}>
                        {m} oy
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#38bdf815', border: '1px solid #38bdf830', fontSize: 13, color: '#7dd3fc' }}>
                    Yangi tugash sanasi: <strong>{(() => { const d = new Date(); d.setMonth(d.getMonth() + payMonths); return fmtDate(d.toISOString()); })()}</strong>
                  </div>
                </div>
              )}

              <div>
                <label style={label}>Izoh (ixtiyoriy)</label>
                <input placeholder="Naqd usulda..." value={payNote} onChange={e => setPayNote(e.target.value)} style={{ ...inp, marginTop: 8, width: '100%', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" style={{...btnGhost, flex: 1}} onClick={() => setPayModal(null)}>Bekor qilish</button>
                <button type="submit" style={{ ...btnPrimary, flex: 1 }} disabled={payLoading}>{payLoading ? 'Kuting...' : 'Saqlash'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Ban Modal */}
      {banModal && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setBanModal(null); }}>
          <div style={modalBox}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', color: '#f8fafc' }}>🚫 Haydovchini bloklash</h2>
            <div style={{ background: '#0f172a', padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>{banModal.driver.fullName || 'Ismsiz'}</div>
            </div>
            <form onSubmit={submitBan}>
              <label style={label}>Nima sababdan bloklanyapti?</label>
              <textarea 
                 style={{...inp, width: '100%', minHeight: 80, boxSizing: 'border-box', marginTop: 8}} 
                 placeholder="Masalan: Qoidalarga amal qilmadi..."
                 value={banReason} onChange={e => setBanReason(e.target.value)}
                 required
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" style={{...btnGhost, flex: 1}} onClick={() => setBanModal(null)}>Bekor</button>
                <button type="submit" style={{ ...btnPrimary, background: '#ef4444', color: '#fff', flex: 1 }}>Bloklashni tasdiqlash</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const pageWrap = { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#090e17', color: '#e2e8f0', fontFamily: '"Inter", sans-serif' };
const header = { background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 100 };
const main = { flex: 1, padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' };
const tabsContainer = { background: 'rgba(15,23,42,0.5)', padding: '16px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const tabsBar = { display: 'flex', gap: 12, overflowX: 'auto', maxWidth: 1200, margin: '0 auto' };
const tabBtn = { padding: '12px 20px', borderRadius: '12px 12px 0 0', border: 'none', background: 'transparent', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderBottom: '3px solid transparent', transition: 'all 0.2s whiteSpace: nowrap' };
const tabActive = { color: '#fbbf24', borderBottom: '3px solid #fbbf24', background: 'linear-gradient(180deg, transparent, rgba(251,191,36,0.05))' };
const sectionTitle = { fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginBottom: 20 };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 };
const statCard = { background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 20, padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' };
const driverCard = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '20px', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const warningCard = { ...driverCard, background: 'linear-gradient(145deg, #1e293b, #291a0b)', borderColor: '#78350f' };
const expiredCard = { ...driverCard, background: 'linear-gradient(145deg, #1e293b, #2d1416)', borderColor: '#7f1d1d' };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modalBox = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '32px', width: '100%', maxWidth: 460, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' };
const inp = { padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#f8fafc', fontSize: 15, outline: 'none', transition: 'border 0.2s' };
const btnPrimary = { padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #fbbf24, #d97706)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 14 };
const btnGhost = { padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const btnSmall = { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const badge = { display: 'inline-flex', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 };
const label = { display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 4 };
const loginBox = { background: '#1e293b', borderRadius: 24, padding: '40px', width: '100%', maxWidth: 420 };
const toggleBtn = { flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const monthBtn = { padding: '10px 16px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 };

/* Basic internal styles for hover etc */
const style = document.createElement('style');
style.innerHTML = `
  .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
  .driver-row:hover { background: rgba(255,255,255,0.02); }
`;
document.head.appendChild(style);
