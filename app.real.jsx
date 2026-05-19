// app.real.jsx — production app shell

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

// Read saved theme from localStorage and merge with defaults (runs once at module load)
const _savedTheme = (() => {
  try { return JSON.parse(localStorage.getItem('it_theme') || '{}'); } catch(e) { return {}; }
})();
const _tweakDefaults = { ...(window.__TWEAK_DEFAULTS__ || { dark: true, accent: '#22c55e' }), ..._savedTheme };

const STATUS_COLORS = {
  OFFER:     { bg: '#22c55e', color: '#fff' },
  INTERVIEW: { bg: '#3b82f6', color: '#fff' },
  PENDING:   { bg: '#f59e0b', color: '#fff' },
  GHOSTED:   { bg: '#64748b', color: '#fff' },
  REJECTED:  { bg: '#ef4444', color: '#fff' },
};

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
        <div className="avatar" style={{ background: current.color, color: 'white' }}>
          {initials2(current.name)}
        </div>
        <span className="name">{current.name}</span>
        <span className="caret"><Icon.Caret size={11} /></span>
      </div>
      {open && (
        <div className="popover">
          <div style={{ padding: '8px 10px 4px', fontSize: 10.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            View as
          </div>
          {[...USERS].sort((a, b) => b.score - a.score).map(u => (
            <div key={u.id}
              className={`popover-item${u.id === currentUserId ? ' active' : ''}`}
              onClick={() => { setCurrentUserId(u.id); setOpen(false); }}
            >
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

function MyApplications({ user }) {
  const apps = user ? (user.applications || []) : [];

  if (apps.length === 0) {
    return (
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title"><Icon.Briefcase size={15} /> My Applications</h3>
            <p className="card-subtitle">No applications yet — log your first above!</p>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...apps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Briefcase size={15} /> My Applications</h3>
          <p className="card-subtitle">{apps.length} application{apps.length !== 1 ? 's' : ''} tracked</p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="lb-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Status</th>
              <th>Tag</th>
              <th className="num">Applied</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(app => {
              const st = app.peak_status || app.status;
              const sc = STATUS_COLORS[st] || STATUS_COLORS.PENDING;
              return (
                <tr key={app.application_id}>
                  <td style={{ fontWeight: 500 }}>
                    {app.job_link ? (
                      <a href={app.job_link} target="_blank" rel="noreferrer"
                         style={{ color: 'inherit', textDecoration: 'none' }}>
                        {app.company_name}
                        <span style={{ opacity: 0.45, fontSize: 11, marginLeft: 3 }}>↗</span>
                      </a>
                    ) : app.company_name}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{app.job_title || '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      background: sc.bg, color: sc.color,
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>{st}</span>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{app.tag || '—'}</td>
                  <td className="num" style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [t, _setTweak] = useTweaks(_tweakDefaults);

  // Persist theme changes to localStorage
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

  // Logged-in user is always fixed (used for dashboard)
  const loggedInUserId = CURRENT_USER.username || (USERS[0] ? USERS[0].id : '');
  const loggedInUser   = USERS.find(u => u.id === loggedInUserId) || USERS[0];

  // Selected user for leaderboard stat strip (switchable via UserSwitcher / row click)
  const [currentUserId, setCurrentUserId] = useStateApp(loggedInUserId);
  const [chartMode,     setChartMode]     = useStateApp('area');
  const [range,         setRange]         = useStateApp('3M');

  // On dashboard always show logged-in user; on leaderboard show selected user
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
      .then(() => {
        onSuccess && onSuccess();
        setTimeout(() => window.location.reload(), 1200);
      })
      .catch(() => { onError && onError(); alert('Failed to add application.'); });
  };

  if (!current) {
    return (
      <div className="app" style={{ paddingTop: 80, textAlign: 'center', color: 'var(--text-3)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="app">

      {/* ── TOPBAR ─────────────────────────────────────────────── */}
      <div className="topbar">
        <a href={basePath + '/dashboard.php'} className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark">i</div>
          <span>intern<span style={{ color: 'var(--text-3)', fontWeight: 500 }}>.</span>track</span>
          <span className="brand-dot"></span>
        </a>

        <div className="nav-tabs">
          <a href={basePath + '/dashboard.php'}
             className={`nav-tab${!isLeaderboard ? ' active' : ''}`}
             style={{ textDecoration: 'none' }}>
            Dashboard
          </a>
          <a href={basePath + '/leaderboard.php'}
             className={`nav-tab${isLeaderboard ? ' active' : ''}`}
             style={{ textDecoration: 'none' }}>
            Leaderboard
          </a>
        </div>

        <div className="topbar-spacer"></div>

        <button className="icon-btn" title={t.dark ? 'Light mode' : 'Dark mode'}
          onClick={() => setTweak('dark', !t.dark)}>
          {t.dark ? <Icon.Sun size={15} /> : <Icon.Moon size={15} />}
        </button>

        {/* UserSwitcher only on leaderboard — dashboard is always your own view */}
        {isLeaderboard && (
          <UserSwitcher currentUserId={currentUserId} setCurrentUserId={setCurrentUserId} />
        )}

        <a href={basePath + '/logout.php'} className="icon-btn" title="Logout"
           style={{ fontSize: 18, textDecoration: 'none' }}>↪</a>
      </div>

      {/* ── STAT STRIP ─────────────────────────────────────────── */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <StatCard
          featured
          rank={rankMap[current.id]}
          icon={<Icon.Trophy size={12} />}
          label={`${current.name}'s score`}
          value={current.score}
          foot={{ text: 'total points earned' }}
        />
        <StatCard
          icon={<Icon.Briefcase size={12} />}
          label="Applications sent"
          value={current.sent}
          foot={{ text: 'all time' }}
        />
        <StatCard
          icon={<Icon.Sparkle size={12} />}
          label="Interviews"
          value={current.interviews}
          foot={{ text: current.sent > 0
            ? `${Math.round((current.interviews / current.sent) * 100)}% conversion`
            : 'no apps yet' }}
        />
        <StatCard
          icon={<Icon.Trophy size={12} />}
          label="Offers"
          value={current.offers}
          foot={{ text: current.offers > 0 ? '🎉 First offer secured!' : 'Still hunting — close!' }}
        />
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────── */}
      {isLeaderboard ? (
        <div className="col">
          <ScoreChart
            currentUserId={currentUserId}
            mode={chartMode} setMode={setChartMode}
            range={range} setRange={setRange}
          />
          <Leaderboard currentUserId={currentUserId} onPickUser={setCurrentUserId} />
        </div>
      ) : (
        <div className="dashboard-grid">
          <div className="col">
            <ScoreChart
              currentUserId={loggedInUserId}
              singleUser={true}
              mode={chartMode} setMode={setChartMode}
              range={range} setRange={setRange}
            />
            <MyApplications user={loggedInUser} />
          </div>
          <div className="col">
            <WeeklyGoal user={loggedInUser} />
            <QuickAdd onAdd={handleAdd} />
          </div>
        </div>
      )}

      {/* ── TWEAKS PANEL ───────────────────────────────────────── */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakToggle label="Dark mode" value={t.dark} onChange={v => setTweak('dark', v)} />
        </TweakSection>
        <TweakSection title="Accent color">
          <TweakColor
            label="Brand green"
            value={t.accent}
            options={['#22c55e','#16a34a','#84cc16','#10b981','#06b6d4']}
            onChange={v => setTweak('accent', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
