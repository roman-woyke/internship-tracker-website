// Leaderboard table — sortable, filterable, with sparklines and expandable application rows

const { useState: useStateLB, useMemo: useMemoLB } = React;

const STATUS_COLORS_LB = {
  OFFER:     { bg: '#22c55e', color: '#fff' },
  INTERVIEW: { bg: '#3b82f6', color: '#fff' },
  PENDING:   { bg: '#f59e0b', color: '#fff' },
  GHOSTED:   { bg: '#64748b', color: '#fff' },
  REJECTED:  { bg: '#ef4444', color: '#fff' },
};

const TAG_CONFIG_LB = {
  'MAYBE':           { bg: '#dc2626', color: '#fff',    label: 'Maybe'       },
  'PROBABLY':        { bg: '#f59e0b', color: '#271600', label: 'Probably'    },
  'FOR SURE':        { bg: '#16a34a', color: '#fff',    label: 'For Sure'    },
  'ABSOLUTE CINEMA': { bg: '#06b6d4', color: '#042f3a', label: 'Absolute C.' },
};

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 56, h = 22;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = data[data.length - 1];
  const lastX = w - 1;
  const lastY = h - 2 - ((last - min) / range) * (h - 4);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

function initials(name) {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
}

const COLUMNS = [
  { id: 'rank',       label: 'Rank',       sortKey: 'score',      invert: true, align: 'left'  },
  { id: 'user',       label: 'User',       sortKey: 'name',                     align: 'left'  },
  { id: 'sent',       label: 'Sent',       sortKey: 'sent',                     align: 'right' },
  { id: 'pending',    label: 'Pending',    pts: '2p',   sortKey: 'pending',     align: 'right' },
  { id: 'rejected',   label: 'Rejected',   pts: '−1p',  sortKey: 'rejected',   align: 'right' },
  { id: 'ghosted',    label: 'Ghosted',    pts: '−1p',  sortKey: 'ghosted',    align: 'right' },
  { id: 'interviews', label: 'Interviews', pts: '10p',  sortKey: 'interviews', align: 'right' },
  { id: 'offers',     label: 'Offers',     pts: '20p',  sortKey: 'offers',     align: 'right' },
  { id: 'trend',      label: 'Trend',                                           align: 'right' },
  { id: 'score',      label: 'Score',      sortKey: 'score', invert: true,      align: 'right' },
];

function Leaderboard({ currentUserId, onPickUser }) {
  const [sort, setSort] = useStateLB({ key: 'score', dir: 'desc' });
  const [query, setQuery] = useStateLB('');
  const [role, setRole] = useStateLB('All');
  const [expandedId, setExpandedId] = useStateLB(null);

  const sorted = useMemoLB(() => {
    const filtered = USERS.filter(u =>
      (role === 'All' || u.role === role) &&
      (query === '' || u.name.toLowerCase().includes(query.toLowerCase()) || u.handle.toLowerCase().includes(query.toLowerCase()))
    );
    const arr = [...filtered].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === 'string') return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sort.dir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [sort, query, role]);

  const rankMap = useMemoLB(() => {
    const m = {};
    [...USERS].sort((a, b) => b.score - a.score).forEach((u, i) => { m[u.id] = i + 1; });
    return m;
  }, []);

  const maxScore = Math.max(...USERS.map(u => u.score));

  const handleSort = (col) => {
    if (!col.sortKey) return;
    setSort(prev => {
      if (prev.key === col.sortKey) return { key: col.sortKey, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      return { key: col.sortKey, dir: col.invert ? 'desc' : 'asc' };
    });
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Trophy size={15} /> Leaderboard</h3>
          <p className="card-subtitle">Score = pending·2 + rejected·(−1) + ghosted·(−1) + interview·10 + offer·20</p>
        </div>
      </div>

      <div className="lb-toolbar">
        <div className="lb-search">
          <span className="icon"><Icon.Search size={14} /></span>
          <input
            placeholder="Search users…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        {ROLES.map(r => (
          <button key={r} className={`chip ${role === r ? 'active' : ''}`} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="lb-table">
          <thead>
            <tr>
              {COLUMNS.map(c => (
                <th
                  key={c.id}
                  className={`${c.align === 'right' ? 'num' : ''} ${c.sortKey && sort.key === c.sortKey ? 'sorted' : ''}`}
                  onClick={() => handleSort(c)}
                >
                  {c.label}{c.pts && <span className="pts">({c.pts})</span>}
                  {c.sortKey && sort.key === c.sortKey && (
                    <span className="sort-ind">{sort.dir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>No users match these filters</td></tr>
            )}
            {sorted.map(u => {
              const r = rankMap[u.id];
              const rankClass = r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';
              const isExpanded = expandedId === u.id;
              return (
                <React.Fragment key={u.id}>
                  <tr
                    className={u.id === currentUserId ? 'me' : ''}
                    onClick={() => { onPickUser(u.id); toggleExpand(u.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span className={`rank-badge ${rankClass}`}>{r}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 9, lineHeight: 1, userSelect: 'none' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="user-cell">
                        <span className="avatar" style={{ background: u.color }}>{initials(u.name)}</span>
                        <div>
                          <div className="uname">
                            {u.name}
                            {u.id === currentUserId && (
                              <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', background: 'var(--accent)', color: 'white', borderRadius: 999, verticalAlign: 'middle', fontWeight: 700 }}>YOU</span>
                            )}
                          </div>
                          <div className="urole">{u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{u.sent}</td>
                    <td className="num">{u.pending}</td>
                    <td className="num">{u.rejected}</td>
                    <td className="num">{u.ghosted}</td>
                    <td className="num" style={{ color: u.interviews >= 4 ? 'var(--accent-strong)' : 'inherit', fontWeight: u.interviews >= 4 ? 700 : 400 }}>{u.interviews}</td>
                    <td className="num" style={{ color: u.offers > 0 ? 'var(--accent-strong)' : 'inherit', fontWeight: u.offers > 0 ? 700 : 400 }}>{u.offers}</td>
                    <td className="num"><Sparkline data={u.hist} color={u.id === currentUserId ? 'var(--accent)' : u.color} /></td>
                    <td className="num">
                      <div className="score-cell">
                        <span className="score-bar"><span style={{ width: `${maxScore > 0 ? (u.score / maxScore) * 100 : 0}%` }}></span></span>
                        <span className="num">{u.score}</span>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={COLUMNS.length} style={{ padding: 0, background: 'var(--surface)' }}>
                        <div style={{ padding: '10px 20px 14px', borderTop: '1px solid var(--border)' }}>
                          {u.applications && u.applications.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr>
                                  {['Company', 'Role', 'Status', 'Tag', 'Applied'].map((h, i) => (
                                    <th key={h} style={{
                                      textAlign: i === 4 ? 'right' : 'left',
                                      padding: '3px 8px 8px',
                                      fontWeight: 500,
                                      color: 'var(--text-3)',
                                      fontSize: 11,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      borderBottom: '1px solid var(--border)',
                                    }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[...u.applications]
                                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                  .map(app => {
                                    const st = app.peak_status || app.status;
                                    const sc = STATUS_COLORS_LB[st] || STATUS_COLORS_LB.PENDING;
                                    const tag = TAG_CONFIG_LB[app.tag];
                                    return (
                                      <tr key={app.application_id} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: '7px 8px', fontWeight: 500 }}>
                                          {app.job_link ? (
                                            <a href={app.job_link} target="_blank" rel="noreferrer"
                                               onClick={e => e.stopPropagation()}
                                               style={{ color: 'inherit', textDecoration: 'none' }}>
                                              {app.company_name}
                                              <span style={{ opacity: 0.45, fontSize: 11, marginLeft: 3 }}>↗</span>
                                            </a>
                                          ) : app.company_name}
                                        </td>
                                        <td style={{ padding: '7px 8px', color: 'var(--text-2)' }}>
                                          {app.job_title || '—'}
                                        </td>
                                        <td style={{ padding: '7px 8px' }}>
                                          <span style={{
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            borderRadius: 999,
                                            background: sc.bg,
                                            color: sc.color,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase',
                                          }}>{st}</span>
                                        </td>
                                        <td style={{ padding: '7px 8px', color: 'var(--text-3)', fontSize: 12 }}>
                                          {tag ? (
                                            <span style={{
                                              display: 'inline-block',
                                              padding: '2px 8px',
                                              borderRadius: 999,
                                              background: tag.bg,
                                              color: tag.color,
                                              fontSize: 10,
                                              fontWeight: 700,
                                              letterSpacing: '0.05em',
                                              textTransform: 'uppercase',
                                              whiteSpace: 'nowrap',
                                            }}>{tag.label}</span>
                                          ) : '—'}
                                        </td>
                                        <td style={{ padding: '7px 8px', color: 'var(--text-3)', fontSize: 12, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                          {new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          ) : (
                            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>No applications logged yet</span>
                          )}
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

      <div className="points-legend">
        <span className="pl-item">Pending = <b>+2p</b></span>
        <span className="pl-item">Rejected = <b>−1p</b></span>
        <span className="pl-item">Ghosted = <b>−1p</b></span>
        <span className="pl-item">Interview = <b>up to 15p</b></span>
        <span className="pl-item">Offer = <b>up to 30p</b></span>
      </div>
    </div>
  );
}

window.Leaderboard = Leaderboard;
