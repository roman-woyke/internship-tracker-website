// app.real.jsx — production app shell
// Replaces app.jsx: uses real user IDs, real nav links, real QuickAdd API call.
// chart.jsx / leaderboard.jsx / sidebar.real.jsx are loaded before this file.

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp } = React;

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

function StatCard({ label, value, foot, deltaDir, featured, rank, icon }) {
  return (
    <div className={`stat${featured ? ' featured' : ''}`}>
      {rank && <span className="stat-rank">RANK #{rank}</span>}
      <div className="stat-label">{icon}{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {deltaDir && (
          <span className={`delta ${deltaDir}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {deltaDir === 'up' ? <Icon.ArrowUp size={11} /> : <Icon.ArrowDown size={11} />}
          </span>
        )}
        {foot && foot.text}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(window.__TWEAK_DEFAULTS__ || { dark: true, accent: '#22c55e' });

  const initData      = window.__INIT_DATA__ || {};
  const view          = initData.view || 'dashboard';
  const basePath      = window.BASE_PATH || '';
  const isLeaderboard = view === 'leaderboard';

  const defaultUser = CURRENT_USER.username || (USERS[0] ? USERS[0].id : '');
  const [currentUserId, setCurrentUserId] = useStateApp(defaultUser);
  const [chartMode,     setChartMode]     = useStateApp('multi');
  const [range,         setRange]         = useStateApp('3M');

  const current = USERS.find(u => u.id === currentUserId) || USERS[0];

  const rankMap = (() => {
    const m = {};
    [...USERS].sort((a, b) => b.score - a.score).forEach((u, i) => { m[u.id] = i + 1; });
    return m;
  })();

  // Apply dark/light theme
  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  // Apply accent colour
  useEffectApp(() => {
    if (!t.accent) return;
    const r = document.documentElement;
    r.style.setProperty('--accent', t.accent);
    r.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 18%, transparent)`);
    r.style.setProperty('--accent-strong', `color-mix(in srgb, ${t.accent} 80%, black)`);
  }, [t.accent]);

  // Wire QuickAdd to the real add-application API
  const handleAdd = ({ company, jobTitle, status }, onSuccess, onError) => {
    const body = new FormData();
    body.append('company_name', company);
    if (jobTitle) body.append('job_title', jobTitle);
    body.append('status', status || 'PENDING');

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

        <UserSwitcher currentUserId={currentUserId} setCurrentUserId={setCurrentUserId} />

        <a href={basePath + '/logout.php'} className="icon-btn" title="Logout"
           style={{ fontSize: 18, textDecoration: 'none' }}>↪</a>
      </div>

      {/* ── STAT STRIP ─────────────────────────────────────────── */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <StatCard
          featured
          rank={rankMap[currentUserId]}
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
              currentUserId={currentUserId}
              mode={chartMode} setMode={setChartMode}
              range={range} setRange={setRange}
            />
            <Leaderboard currentUserId={currentUserId} onPickUser={setCurrentUserId} />
          </div>
          <div className="col">
            <WeeklyGoal user={current} />
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
