// Sidebar: weekly goal + new listings + quick-add

const { useState: useStateSB } = React;

function WeeklyGoal({ user }) {
  const goal = 10;
  const thisWeek = 7; // mock
  const pct = Math.min(1, thisWeek / goal);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const done = [true, true, true, false, true, true, false];
  const today = 4; // Friday-ish
  const streak = 12;

  // SVG ring
  const r = 32, c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div className="card goal-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Flame size={14} /> Weekly goal</h3>
          <p className="card-subtitle">{user.name} · {streak}-day streak 🔥</p>
        </div>
        <span className="live-pill">On track</span>
      </div>

      <div className="goal-progress">
        <div className="goal-ring-wrap">
          <svg viewBox="0 0 78 78" width="78" height="78">
            <circle cx="39" cy="39" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle
              cx="39" cy="39" r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 39 39)"
              style={{ transition: 'stroke-dasharray 0.6s' }}
            />
          </svg>
          <div className="center">
            <small>Applied</small>
            {thisWeek}/{goal}
          </div>
        </div>
        <div className="goal-text">
          <div className="big">{goal - thisWeek} to go this week</div>
          <div className="sub">Keep applying to hit your weekly target. Top performers send ~12/week.</div>
        </div>
      </div>

      <div className="streak-row">
        {days.map((d, i) => (
          <div
            key={i}
            className={`streak-day ${done[i] ? 'done' : ''} ${i === today ? 'today' : ''}`}
            title={done[i] ? `${d}: ${Math.floor(Math.random()*3)+1} sent` : 'No activity'}
          >
            {d}
            {done[i] && i <= today && <span className="flame">{i === today ? '🔥' : ''}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewListings() {
  const [applied, setApplied] = useStateSB(new Set());
  const [filter, setFilter] = useStateSB('all'); // all | hot

  const visible = LISTINGS.filter(l => filter === 'all' || l.hot);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.LinkedIn size={14} /> Fresh on LinkedIn <span className="live-pill"><span className="live-dot"></span>Live</span></h3>
          <p className="card-subtitle">Internships posted today, matched to your saved searches</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`chip ${filter === 'hot' ? 'active' : ''}`} onClick={() => setFilter('hot')}>🔥 Hot</button>
        </div>
      </div>

      <div>
        {visible.map(l => (
          <div key={l.id} className="listing">
            <div className="logo" style={{ background: l.color }}>{l.logo}</div>
            <div className="listing-body">
              <div className="listing-title">{l.title}</div>
              <div className="listing-meta">
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{l.company}</span>
                <span className="dot">·</span>
                <span>{l.loc}</span>
                <span className="dot">·</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{l.salary}</span>
              </div>
              <div className="listing-tags">
                {l.hot && <span className="tag hot">🔥 Trending</span>}
                {l.tags.map(t => <span key={t} className="tag">{t}</span>)}
                <span className="tag" style={{ fontFamily: 'var(--font-mono)' }}>{l.applicants}</span>
              </div>
            </div>
            <div className="listing-act">
              <span className="when">{l.when}</span>
              <button
                className={`btn-apply ${applied.has(l.id) ? 'applied' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setApplied(prev => {
                    const next = new Set(prev);
                    if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                    return next;
                  });
                }}
              >
                {applied.has(l.id) ? (<><Icon.Check size={11} /> Tracked</>) : (<>+ Track</>)}
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No hot listings right now</div>
        )}
      </div>

      <div className="listings-foot">
        <button className="btn-link">See all 47 new listings <Icon.External size={11} /></button>
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { id: 'pending',    label: 'Pending',    pts: 2 },
  { id: 'rejected',   label: 'Rejected',   pts: 1 },
  { id: 'interviews', label: 'Interview',  pts: 10 },
  { id: 'offers',     label: 'Offer',      pts: 20 },
];

function QuickAdd({ onAdd }) {
  const [company, setCompany] = useStateSB('');
  const [role, setRole] = useStateSB('SWE Intern');
  const [source, setSource] = useStateSB('LinkedIn');
  const [status, setStatus] = useStateSB('pending');
  const [success, setSuccess] = useStateSB(false);

  const submit = (e) => {
    e.preventDefault();
    if (!company.trim()) return;
    onAdd && onAdd({ company, role, source, status });
    setCompany('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2200);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Plus size={14} /> Log an application</h3>
          <p className="card-subtitle">Quick-add what you sent today</p>
        </div>
      </div>

      <form className="qa-form" onSubmit={submit}>
        <div>
          <label className="qa-label">Company</label>
          <input className="qa-input" placeholder="e.g. Lumen Labs" value={company} onChange={e => setCompany(e.target.value)} />
        </div>
        <div className="qa-row">
          <div>
            <label className="qa-label">Role</label>
            <select className="qa-select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.slice(1).map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="qa-label">Source</label>
            <select className="qa-select" value={source} onChange={e => setSource(e.target.value)}>
              <option>LinkedIn</option>
              <option>Referral</option>
              <option>Career page</option>
              <option>University</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="qa-label">Status</label>
          <div className="qa-status-grid">
            {STATUS_OPTIONS.map(o => (
              <button
                type="button"
                key={o.id}
                className={`qa-status ${status === o.id ? 'active' : ''}`}
                onClick={() => setStatus(o.id)}
              >
                {o.label}
                <span className="pts">+{o.pts}p</span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary accent" type="submit"><Icon.Plus size={14} /> Add to tracker</button>
        {success && (
          <div className="qa-success"><Icon.Check size={13} /> Logged · score updated</div>
        )}
      </form>
    </div>
  );
}

window.WeeklyGoal = WeeklyGoal;
window.NewListings = NewListings;
window.QuickAdd = QuickAdd;
