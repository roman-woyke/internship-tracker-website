// Root app — wires everything together with tweaks state

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
          {[...USERS].sort((a,b) => b.score - a.score).map(u => (
            <div
              key={u.id}
              className={`popover-item ${u.id === currentUserId ? 'active' : ''}`}
              onClick={() => { setCurrentUserId(u.id); setOpen(false); }}
            >
              <span className="avatar" style={{ background: u.color }}>{initials2(u.name)}</span>
              <div className="info">
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="secondary">{u.role}</div>
              </div>
              <span className="secondary">{u.score}p</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, foot, deltaDir, featured, rank, icon }) {
  return (
    <div className={`stat ${featured ? 'featured' : ''}`}>
      {rank && <span className="stat-rank">RANK #{rank}</span>}
      <div className="stat-label">{icon}{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {deltaDir && (
          <span className={`delta ${deltaDir}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {deltaDir === 'up' ? <Icon.ArrowUp size={11} /> : <Icon.ArrowDown size={11} />}
            {foot.delta}
          </span>
        )}
        {foot.text}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(window.__TWEAK_DEFAULTS__);

  const [currentUserId, setCurrentUserId] = useStateApp('basti');
  const [chartMode, setChartMode] = useStateApp('multi');
  const [range, setRange] = useStateApp('3M');

  const current = USERS.find(u => u.id === currentUserId);
  const rankMap = (() => {
    const m = {};
    [...USERS].sort((a, b) => b.score - a.score).forEach((u, i) => { m[u.id] = i + 1; });
    return m;
  })();

  // ---- live theme + accent
  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  useEffectApp(() => {
    if (!t.accent) return;
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    // Derive soft + strong from accent
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 18%, transparent)`);
    root.style.setProperty('--accent-strong', `color-mix(in srgb, ${t.accent} 80%, black)`);
  }, [t.accent]);

  const ACCENT_OPTIONS = ['#22c55e', '#16a34a', '#84cc16', '#10b981', '#06b6d4'];

  return (
    <div className="app">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">i</div>
          <span>intern<span style={{ color: 'var(--text-3)', fontWeight: 500 }}>.</span>track</span>
          <span className="brand-dot"></span>
        </div>
        <div className="nav-tabs">
          <button className="nav-tab active">Dashboard</button>
          <button className="nav-tab">Applications</button>
          <button className="nav-tab">Discover</button>
          <button className="nav-tab">Notes</button>
        </div>
        <div className="topbar-spacer"></div>
        <button className="icon-btn" title="Notifications"><Icon.Bell size={15} /></button>
        <button
          className="icon-btn"
          title={t.dark ? 'Switch to light' : 'Switch to dark'}
          onClick={() => setTweak('dark', !t.dark)}
        >
          {t.dark ? <Icon.Sun size={15} /> : <Icon.Moon size={15} />}
        </button>
        <UserSwitcher currentUserId={currentUserId} setCurrentUserId={setCurrentUserId} />
      </div>

      {/* HERO STAT STRIP */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        <StatCard
          featured
          rank={rankMap[currentUserId]}
          icon={<Icon.Trophy size={12} />}
          label={`${current.name}'s score`}
          value={current.score}
          deltaDir="up"
          foot={{ delta: '+34 this week', text: ' · across 8 trackers' }}
        />
        <StatCard
          icon={<Icon.Briefcase size={12} />}
          label="Applications sent"
          value={current.sent}
          deltaDir="up"
          foot={{ delta: '+5', text: ' vs last week' }}
        />
        <StatCard
          icon={<Icon.Sparkle size={12} />}
          label="Interviews"
          value={current.interviews}
          deltaDir="up"
          foot={{ delta: '+1', text: ` · ${Math.round((current.interviews / current.sent) * 100)}% conversion` }}
        />
        <StatCard
          icon={<Icon.Trophy size={12} />}
          label="Offers"
          value={current.offers}
          foot={{ text: current.offers > 0 ? '🎉 First offer secured' : 'Still hunting — close!' }}
        />
      </div>

      {/* MAIN GRID */}
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
          <NewListings />
          <QuickAdd />
        </div>
      </div>

      {/* TWEAKS panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakToggle
            label="Dark mode"
            value={t.dark}
            onChange={(v) => setTweak('dark', v)}
          />
        </TweakSection>
        <TweakSection title="Accent color">
          <TweakColor
            label="Brand green"
            value={t.accent}
            options={ACCENT_OPTIONS}
            onChange={(v) => setTweak('accent', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
