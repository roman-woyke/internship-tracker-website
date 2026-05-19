// sidebar.real.jsx — production sidebar
// WeeklyGoal uses real weekly data from CURRENT_USER (set by data.real.jsx).
// NewListings is hidden (no real data source).
// QuickAdd calls back to parent's onAdd handler (wired to API in app.real.jsx).

const { useState: useStateSB } = React;

function WeeklyGoal({ user }) {
  const goal  = 10;
  const cu    = window.CURRENT_USER || {};
  const thisWeek    = cu.weeklyApps    || 0;
  const dailyDone   = cu.dailyActivity || [false,false,false,false,false,false,false];
  const todayDow    = cu.todayDow !== undefined ? cu.todayDow : ((new Date().getDay() + 6) % 7);
  const days = ['M','T','W','T','F','S','S'];

  const r    = 32;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, thisWeek / goal);

  return (
    <div className="card goal-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Flame size={14} /> Weekly goal</h3>
          <p className="card-subtitle">{user.name} · {thisWeek} applied this week</p>
        </div>
        <span className="live-pill">{thisWeek >= goal ? '✓ Done!' : 'On track'}</span>
      </div>

      <div className="goal-progress">
        <div className="goal-ring-wrap">
          <svg viewBox="0 0 78 78" width="78" height="78">
            <circle cx="39" cy="39" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
            <circle cx="39" cy="39" r={r} fill="none" stroke="var(--accent)" strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
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
          <div className="big">
            {thisWeek >= goal ? 'Goal crushed! 🎉' : `${goal - thisWeek} to go this week`}
          </div>
          <div className="sub">Top performers send ~{goal}/week. Keep going!</div>
        </div>
      </div>

      <div className="streak-row">
        {days.map((d, i) => (
          <div key={i}
            className={`streak-day${dailyDone[i] ? ' done' : ''}${i === todayDow ? ' today' : ''}`}
          >
            {d}
            {dailyDone[i] && i === todayDow && <span className="flame">🔥</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_OPTIONS = [
  { id: 'PENDING',   label: 'Pending',   pts: 2  },
  { id: 'REJECTED',  label: 'Rejected',  pts: 1  },
  { id: 'INTERVIEW', label: 'Interview', pts: 5  },
  { id: 'OFFER',     label: 'Offer',     pts: 18 },
];

function QuickAdd({ onAdd }) {
  const [company,  setCompany]  = useStateSB('');
  const [jobTitle, setJobTitle] = useStateSB('');
  const [status,   setStatus]   = useStateSB('PENDING');
  const [success,  setSuccess]  = useStateSB(false);
  const [loading,  setLoading]  = useStateSB(false);

  const submit = (e) => {
    e.preventDefault();
    if (!company.trim() || loading) return;
    setLoading(true);
    onAdd && onAdd(
      { company, jobTitle, status },
      () => {
        setCompany(''); setJobTitle(''); setLoading(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2200);
      },
      () => setLoading(false)
    );
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
          <label className="qa-label">Company *</label>
          <input className="qa-input" placeholder="e.g. Google"
            value={company} onChange={e => setCompany(e.target.value)} required />
        </div>
        <div>
          <label className="qa-label">Job title</label>
          <input className="qa-input" placeholder="e.g. Software Engineer Intern"
            value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
        </div>
        <div>
          <label className="qa-label">Status</label>
          <div className="qa-status-grid">
            {STATUS_OPTIONS.map(o => (
              <button type="button" key={o.id}
                className={`qa-status${status === o.id ? ' active' : ''}`}
                onClick={() => setStatus(o.id)}
              >
                {o.label}
                <span className="pts">+{o.pts}p</span>
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary accent" type="submit" disabled={loading}>
          <Icon.Plus size={14} /> {loading ? 'Adding…' : 'Add to tracker'}
        </button>
        {success && (
          <div className="qa-success">
            <Icon.Check size={13} /> Logged · score updated
          </div>
        )}
      </form>
    </div>
  );
}

// Override globals so app.real.jsx picks up the real versions
window.WeeklyGoal  = WeeklyGoal;
window.QuickAdd    = QuickAdd;
window.NewListings = function() { return null; };
