const fs = require('fs');
let content = fs.readFileSync('/media/gvazar/storage_data1/taxi-free/frontend/src/pages/AdminPanel.jsx', 'utf8');

// 1. Add Complaints Tab
if (!content.includes("{ id: 'complaints', label: 'E`tirozlar' }")) {
  content = content.replace(
    /const TABS = \[\s*\{ id: 'stats', label: 'Statistika' \},\s*\{ id: 'drivers', label: 'Haydovchilar' \},\s*\{ id: 'groups', label: 'Haydovchi guruhlari' \},\s*\{ id: 'team', label: 'Jamoa', superOnly: true \},\s*\];/i,
    "const TABS = [\n  { id: 'stats', label: 'Statistika' },\n  { id: 'drivers', label: 'Haydovchilar' },\n  { id: 'groups', label: 'Haydovchi guruhlari' },\n  { id: 'complaints', label: 'E`tirozlar' },\n  { id: 'team', label: 'Jamoa', superOnly: true },\n];"
  );
}

// 2. Add state
if (!content.includes('const [complaints, setComplaints] = useState([]);')) {
  content = content.replace(
    '  const [drivers, setDrivers] = useState([]);',
    "  const [drivers, setDrivers] = useState([]);\n  const [complaints, setComplaints] = useState([]);"
  );
}

// 3. Add load logic map
if (!content.includes('const loadComplaints = useCallback')) {
  content = content.replace(
    '  const loadGroups = useCallback(async () => {',
    "  const loadComplaints = useCallback(async () => {\n    const r = await adminApi('/api/admin/complaints');\n    if (r.ok) setComplaints(await r.json());\n    else setSectionMsg('E\\'tirozlarni yuklab bo\\'lmadi.');\n  }, []);\n\n  const loadGroups = useCallback(async () => {"
  );
}

// 4. Call it in useEffect
content = content.replace(
  /} else if \(tab === 'groups'\) await loadGroups\(\);/g,
  "} else if (tab === 'groups') await loadGroups();\n        else if (tab === 'complaints') await loadComplaints();"
);

content = content.replace(
  /loadGroups, driversBannedOnly\]\);/g,
  "loadGroups, driversBannedOnly, loadComplaints]);"
);

// 5. Add UI logic for rendering complaints tab
const complaintUIRegex = /\{\/\* ── COMPLAINTS TAB ── \*\/\}/g;
if (!complaintUIRegex.test(content)) {
  const insertIndex = content.indexOf("{tab === 'groups' ? (");
  if (insertIndex !== -1) {
    const stringToInsert = `
      {/* ── COMPLAINTS TAB ── */}
      {tab === 'complaints' && !sectionLoading ? (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {complaints.length === 0 && <p style={{ color: '#94a3b8' }}>E'tirozlar yo'q.</p>}
          {complaints.map(c => (
            <div key={c.id} style={{ ...card, borderLeft: c.is_resolved ? '4px solid #4ade80' : '4px solid #fbbf24', opacity: c.is_resolved ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.is_resolved ? '#4ade80' : '#fbbf24', marginBottom: 8, textTransform: 'uppercase' }}>
                    {c.is_resolved ? 'Hal qilingan' : 'Yangi e\\'tiroz'}
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 15, color: '#f8fafc', lineHeight: 1.5 }}>"{c.complaint_text}"</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                    Shikoyatchi: <strong style={{color: '#fff'}}>{c.phone || "Noma'lum"}</strong> ({c.from_who === 'driver' ? 'Haydovchi' : 'Yo\\'lovchi'})
                  </p>
                  {c.driver_id && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                    Kim ustidan: <strong style={{color: '#fff'}}>{c.driver_name} [{c.driver_car}]</strong> (ID: {c.driver_id})
                  </p>}
                </div>
                {!c.is_resolved && (
                  <button onClick={async () => {
                     const r = await adminApi(\`/api/admin/complaints/\${c.id}/resolve\`, { method: 'POST' });
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

`;
    content = content.slice(0, insertIndex) + stringToInsert + content.slice(insertIndex);
  }
}

// 6. Fix CSS issues: Make text brighter and readable in inputs and selects
content = content.replace(/color: '#e2e8f0', textAlign: 'right'/g, "color: '#fff', textAlign: 'right', fontWeight: 600");
content = content.replace(/color: '#e2e8f0'/g, "color: '#f8fafc'");

fs.writeFileSync('/media/gvazar/storage_data1/taxi-free/frontend/src/pages/AdminPanel.jsx', content, 'utf8');
console.log('AdminPanel patched safely.');
