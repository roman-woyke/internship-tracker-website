// app.real.jsx — production app shell

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

// ── Theme persistence ─────────────────────────────────────────────────────────
const _savedTheme = (() => {
  try { return JSON.parse(localStorage.getItem('it_theme') || '{}'); } catch(e) { return {}; }
})();
const _tweakDefaults = { ...(window.__TWEAK_DEFAULTS__ || { dark: true, accent: '#22c55e' }), ..._savedTheme };

// ── Shared style constants ────────────────────────────────────────────────────
const STATUS_COLORS = {
  OFFER:     { bg: '#22c55e', color: '#fff' },
  INTERVIEW: { bg: '#3b82f6', color: '#fff' },
  PENDING:   { bg: '#f59e0b', color: '#fff' },
  GHOSTED:   { bg: '#64748b', color: '#fff' },
  REJECTED:  { bg: '#ef4444', color: '#fff' },
};

// Tags ordered by importance (low -> high), with the top tier in a cooler green.
const TAG_CONFIG = {
  '':                { bg: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', label: '— none'          },
  'MAYBE':           { bg: '#dc2626',     border: 'none',                    color: '#fff',           label: 'Maybe'           },
  'PROBABLY':        { bg: '#f59e0b',     border: 'none',                    color: '#271600',        label: 'Probably'        },
  'FOR SURE':        { bg: '#16a34a',     border: 'none',                    color: '#fff',           label: 'For Sure'        },
  'ABSOLUTE CINEMA': { bg: '#06b6d4',     border: 'none',                    color: '#042f3a',        label: 'Absolute C.'     },
};

const STATUS_EDIT_OPTIONS = ['PENDING','REJECTED','GHOSTED','INTERVIEW','OFFER'];

const actionBtn = {
  appearance: 'none', border: '1px solid var(--border)', borderRadius: 6,
  background: 'transparent', color: 'var(--text-2)',
  fontSize: 11, padding: '3px 8px', cursor: 'pointer', lineHeight: 1,
};

function badgeSty(bg, color, border) {
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    background: bg, color, border: border || 'none',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  };
}

// ── UserSwitcher ──────────────────────────────────────────────────────────────
function initials2(name) {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
}

function UserSwitcher({ currentUserId, setCurrentUserId }) {
  const [open, setOpen] = useStateApp(false);
  const ref = useRefApp(null);
  const current = USERS.find(u => u.id === currentUserId) || USERS[0];

  useEffectApp(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!current) return null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="user-chip" onClick={() => setOpen(o => !o)}>
        <div className="avatar" style={{ background: current.color, color: 'white' }}>{initials2(current.name)}</div>
        <span className="name">{current.name}</span>
        <span className="caret"><Icon.Caret size={11} /></span>
      </div>
      {open && (
        <div className="popover">
          <div style={{ padding: '8px 10px 4px', fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>View as</div>
          {[...USERS].sort((a, b) => b.score - a.score).map(u => (
            <div key={u.id} className={`popover-item${u.id === currentUserId ? ' active' : ''}`}
              onClick={() => { setCurrentUserId(u.id); setOpen(false); }}>
              <span className="avatar" style={{ background: u.color }}>{initials2(u.name)}</span>
              <div className="info">
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="secondary">{u.score}p</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, foot, featured, rank, icon }) {
  return (
    <div className={`stat${featured ? ' featured' : ''}`}>
      {rank && <span className="stat-rank">RANK #{rank}</span>}
      <div className="stat-label">{icon}{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{foot && foot.text}</div>
    </div>
  );
}

// ── MyApplications ────────────────────────────────────────────────────────────
function MyApplications({ user }) {
  const initApps = [...(user?.applications || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [apps, setApps]                     = useStateApp(initApps);
  const [expandedId, setExpandedId]         = useStateApp(null);
  const [statusOpen, setStatusOpen]         = useStateApp(null);
  const [tagOpen, setTagOpen]               = useStateApp(null);
  const [deleteConfirm, setDeleteConfirm]   = useStateApp(null);
  const [editDraft, setEditDraft]           = useStateApp({});
  const [saving, setSaving]                 = useStateApp({});
  const bPath = window.BASE_PATH || '';

  // Close popovers on outside click
  useEffectApp(() => {
    const close = () => { setStatusOpen(null); setTagOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const patchApp = (appId, fields) => {
    const body = new FormData();
    body.append('application_id', appId);
    Object.entries(fields).forEach(([k, v]) => body.append(k, v == null ? '' : v));
    return fetch(bPath + '/api/patch-application.php', { method: 'POST', body })
      .then(r => { if (!r.ok) throw new Error('patch failed'); });
  };

  const changeStatus = (appId, newStatus) => {
    setStatusOpen(null);
    setApps(prev => prev.map(a => a.application_id === appId ? { ...a, status: newStatus } : a));
    patchApp(appId, { status: newStatus }).catch(() => {
      alert('Failed to update status.');
      setApps(initApps);
    });
  };

  const changeTag = (appId, newTag) => {
    setTagOpen(null);
    setApps(prev => prev.map(a => a.application_id === appId ? { ...a, tag: newTag || null } : a));
    patchApp(appId, { tag: newTag }).catch(() => alert('Failed to update tag.'));
  };

  const toggleExpand = (appId) => {
    if (expandedId === appId) { setExpandedId(null); return; }
    const app = apps.find(a => a.application_id === appId);
    setEditDraft(d => ({ ...d, [appId]: { notes: app?.notes || '', jobLink: app?.job_link || '' } }));
    setExpandedId(appId);
    setStatusOpen(null);
    setTagOpen(null);
  };

  const saveExpanded = (appId) => {
    const { notes, jobLink } = editDraft[appId] || {};
    setSaving(s => ({ ...s, [appId]: true }));
    setApps(prev => prev.map(a => a.application_id === appId
      ? { ...a, notes: notes || null, job_link: jobLink || null } : a));
    patchApp(appId, { notes: notes || '', job_link: jobLink || '' })
      .then(() => { setSaving(s => ({ ...s, [appId]: false })); setExpandedId(null); })
      .catch(() => { setSaving(s => ({ ...s, [appId]: false })); alert('Failed to save.'); });
  };

  const doDelete = (appId) => {
    const body = new FormData();
    body.append('application_id', appId);
    fetch(bPath + '/api/delete-application.php', { method: 'POST', body })
      .then(r => { if (!r.ok) throw new Error(); })
      .then(() => { setApps(prev => prev.filter(a => a.application_id !== appId)); setDeleteConfirm(null); })
      .catch(() => { setDeleteConfirm(null); alert('Failed to delete.'); });
  };

  if (apps.length === 0) {
    return (
      <div className="card">
        <div className="card-head"><div>
          <h3 className="card-title"><Icon.Briefcase size={15} /> My Applications</h3>
          <p className="card-subtitle">No applications yet — log your first above!</p>
        </div></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head"><div>
        <h3 className="card-title"><Icon.Briefcase size={15} /> My Applications</h3>
        <p className="card-subtitle">{apps.length} application{apps.length !== 1 ? 's' : ''} tracked</p>
      </div></div>

      <div style={{ overflowX: 'auto' }}>
        <table className="lb-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '42%' }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 116 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Tag</th>
              <th className="num">Applied</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => {
              const appId    = app.application_id;
              const st       = app.status;
              const sc       = STATUS_COLORS[st] || STATUS_COLORS.PENDING;
              const tagKey   = app.tag || '';
              const tc       = TAG_CONFIG[tagKey] || TAG_CONFIG[''];
              const isExpanded   = expandedId   === appId;
              const isDelConfirm = deleteConfirm === appId;
              const draft = editDraft[appId] || { notes: app.notes || '', jobLink: app.job_link || '' };

              return (
                <React.Fragment key={appId}>
                  <tr>
                    {/* Company */}
                    <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.job_link
                        ? <a href={app.job_link} target="_blank" rel="noreferrer"
                             style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>
                            {app.company_name}<span style={{ opacity: 0.4, fontSize: 11, marginLeft: 3 }}>↗</span>
                          </a>
                        : app.company_name}
                    </td>

                    {/* Role */}
                    <td style={{ color: 'var(--text-2)' }}>{app.job_title || '—'}</td>

                    {/* Status badge + popover */}
                    <td>
                      <div style={{ position: 'relative', display: 'inline-block' }}
                           onMouseDown={e => e.stopPropagation()}>
                        <span style={badgeSty(sc.bg, sc.color)}
                              onClick={() => { setStatusOpen(statusOpen === appId ? null : appId); setTagOpen(null); }}>
                          {st} <span style={{ opacity: 0.7, fontSize: 9 }}>▾</span>
                        </span>
                        {statusOpen === appId && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 300,
                            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                            padding: 4, minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
                            {STATUS_EDIT_OPTIONS.map(sid => {
                              const oc = STATUS_COLORS[sid];
                              return (
                                <div key={sid} style={{ padding: '5px 8px', cursor: 'pointer', borderRadius: 6 }}
                                     onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                     onClick={() => changeStatus(appId, sid)}>
                                  <span style={badgeSty(oc.bg, oc.color)}>{sid}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Tag badge + popover */}
                    <td>
                      <div style={{ position: 'relative', display: 'inline-block' }}
                           onMouseDown={e => e.stopPropagation()}>
                        <span style={tagKey
                            ? badgeSty(tc.bg, tc.color, tc.border)
                            : { fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => { setTagOpen(tagOpen === appId ? null : appId); setStatusOpen(null); }}>
                          {tagKey ? tc.label : '—'} <span style={{ opacity: 0.6, fontSize: 9 }}>▾</span>
                        </span>
                        {tagOpen === appId && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 300,
                            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                            padding: 4, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
                            {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
                              <div key={key} style={{ padding: '5px 8px', cursor: 'pointer', borderRadius: 6 }}
                                   onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                   onClick={() => changeTag(appId, key)}>
                                {key
                                  ? <span style={badgeSty(cfg.bg, cfg.color, cfg.border)}>{cfg.label}</span>
                                  : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>✕ Remove tag</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="num" style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {isDelConfirm ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>Delete?</span>
                            <button style={{ ...actionBtn, background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                                    onClick={() => doDelete(appId)}>Yes</button>
                            <button style={actionBtn} onClick={() => setDeleteConfirm(null)}>No</button>
                          </>
                        ) : (
                          <>
                            {app.notes && <span style={{ fontSize: 12 }} title={app.notes}>📝</span>}
                            <button style={actionBtn} title={isExpanded ? 'Close' : 'Edit link & notes'}
                                    onClick={() => toggleExpand(appId)}>
                              {isExpanded ? '▲' : '✎'}
                            </button>
                            <button style={actionBtn} title="Delete"
                                    onClick={() => setDeleteConfirm(appId)}>✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4,
                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Job link
                              </div>
                              <input className="qa-input" type="url" placeholder="https://…"
                                value={draft.jobLink}
                                onChange={e => setEditDraft(d => ({ ...d, [appId]: { ...d[appId], jobLink: e.target.value } }))} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4,
                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Notes
                              </div>
                              <textarea className="qa-input" placeholder="Any notes…"
                                value={draft.notes}
                                onChange={e => setEditDraft(d => ({ ...d, [appId]: { ...d[appId], notes: e.target.value } }))}
                                rows={2}
                                style={{ resize: 'vertical', minHeight: 52, fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 1.4 }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-primary accent"
                                    style={{ fontSize: 12, padding: '5px 14px' }}
                                    disabled={saving[appId]}
                                    onClick={() => saveExpanded(appId)}>
                              {saving[appId] ? 'Saving…' : 'Save'}
                            </button>
                            <button style={{ ...actionBtn, padding: '5px 12px', fontSize: 12 }}
                                    onClick={() => setExpandedId(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [t, _setTweak] = useTweaks(_tweakDefaults);

  const setTweak = (keyOrObj, val) => {
    _setTweak(keyOrObj, val);
    try {
      const saved = JSON.parse(localStorage.getItem('it_theme') || '{}');
      if (typeof keyOrObj === 'object' && keyOrObj !== null) Object.assign(saved, keyOrObj);
      else saved[keyOrObj] = val;
      localStorage.setItem('it_theme', JSON.stringify(saved));
    } catch(e) {}
  };

  const initData      = window.__INIT_DATA__ || {};
  const view          = initData.view || 'dashboard';
  const basePath      = window.BASE_PATH || '';
  const isLeaderboard = view === 'leaderboard';

  const loggedInUserId = CURRENT_USER.username || (USERS[0] ? USERS[0].id : '');
  const loggedInUser   = USERS.find(u => u.id === loggedInUserId) || USERS[0];

  const [currentUserId, setCurrentUserId] = useStateApp(loggedInUserId);
  const [chartMode,     setChartMode]     = useStateApp('area');
  const [range,         setRange]         = useStateApp('3M');

  const current = isLeaderboard
    ? (USERS.find(u => u.id === currentUserId) || USERS[0])
    : loggedInUser;

  const rankMap = (() => {
    const m = {};
    [...USERS].sort((a, b) => b.score - a.score).forEach((u, i) => { m[u.id] = i + 1; });
    return m;
  })();

  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  useEffectApp(() => {
    if (!t.accent) return;
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 18%, transparent)`);
    r.style.setProperty('--accent-strong', `color-mix(in srgb, ${t.accent} 80%, black)`);
  }, [t.accent]);

  const handleAdd = ({ company, jobTitle, status, tag, jobLink, location, notes }, onSuccess, onError) => {
    const body = new FormData();
    body.append('company_name', company);
    if (jobTitle)  body.append('job_title', jobTitle);
    body.append('status', status || 'PENDING');
    if (tag)       body.append('tag', tag);
    if (jobLink)   body.append('job_link', jobLink);
    if (location)  body.append('location', location);
    if (notes)     body.append('notes', notes);
    fetch(basePath + '/api/add-application.php', { method: 'POST', body })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(() => { onSuccess && onSuccess(); setTimeout(() => window.location.reload(), 1200); })
      .catch(() => { onError && onError(); alert('Failed to add application.'); });
  };

  if (!current) {
    return <div className="app" style={{ paddingTop: 80, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>;
  }

  return (
    <div className="app">

      {/* ── TOPBAR ── */}
      <div className="topbar">
        <a href={basePath + '/dashboard.php'} className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark">i</div>
          <span>intern<span style={{ color: 'var(--text-3)', fontWeight: 500 }}>.</span>track</span>
          <span className="brand-dot"></span>
        </a>
        <div className="nav-tabs">
          <a href={basePath + '/dashboard.php'} className={`nav-tab${!isLeaderboard ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Dashboard</a>
          <a href={basePath + '/leaderboard.php'} className={`nav-tab${isLeaderboard ? ' active' : ''}`} style={{ textDecoration: 'none' }}>Leaderboard</a>
        </div>
        <div className="topbar-spacer"></div>
        <button className="icon-btn" title={t.dark ? 'Light mode' : 'Dark mode'}
          onClick={() => setTweak('dark', !t.dark)}>
          {t.dark ? <Icon.Sun size={15} /> : <Icon.Moon size={15} />}
        </button>
        {isLeaderboard && <UserSwitcher currentUserId={currentUserId} setCurrentUserId={setCurrentUserId} />}
        <a href={basePath + '/logout.php'} className="icon-btn" title="Logout" style={{ fontSize: 18, textDecoration: 'none' }}>↪</a>
      </div>

      {/* ── STAT STRIP ── */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <StatCard featured rank={rankMap[current.id]} icon={<Icon.Trophy size={12} />}
          label={`${current.name}'s score`} value={current.score} foot={{ text: 'total points earned' }} />
        <StatCard icon={<Icon.Briefcase size={12} />} label="Applications sent"
          value={current.sent} foot={{ text: 'all time' }} />
        <StatCard icon={<Icon.Sparkle size={12} />} label="Interviews"
          value={current.interviews}
          foot={{ text: current.sent > 0 ? `${Math.round((current.interviews / current.sent) * 100)}% conversion` : 'no apps yet' }} />
        <StatCard icon={<Icon.Trophy size={12} />} label="Offers"
          value={current.offers}
          foot={{ text: current.offers > 0 ? '🎉 First offer secured!' : 'Still hunting — close!' }} />
      </div>

      {/* ── MAIN CONTENT ── */}
      {isLeaderboard ? (
        <div className="col">
          <ScoreChart currentUserId={currentUserId} mode={chartMode} setMode={setChartMode} range={range} setRange={setRange} />
          <Leaderboard currentUserId={currentUserId} onPickUser={setCurrentUserId} />
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="col">
            <ScoreChart currentUserId={loggedInUserId} singleUser={true} mode={chartMode} setMode={setChartMode} range={range} setRange={setRange} />
            <MyApplications user={loggedInUser} />
          </div>
          <div className="col">
            <WeeklyGoal user={loggedInUser} />
            <QuickAdd onAdd={handleAdd} />
          </div>
        </div>
      )}

      {/* ── TWEAKS PANEL ── */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakToggle label="Dark mode" value={t.dark} onChange={v => setTweak('dark', v)} />
        </TweakSection>
        <TweakSection title="Accent color">
          <TweakColor label="Brand green" value={t.accent}
            options={['#22c55e','#16a34a','#84cc16','#10b981','#06b6d4']}
            onChange={v => setTweak('accent', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
