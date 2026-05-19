// sidebar.real.jsx — production sidebar
// WeeklyGoal uses real weekly data from CURRENT_USER (set by data.real.jsx).
// QuickAdd includes all application fields: status, tag, job_link, location, notes.

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
  { id: 'PENDING',   label: 'Pending',   pts: '+2'  },
  { id: 'REJECTED',  label: 'Rejected',  pts: '−1'  },
  { id: 'GHOSTED',   label: 'Ghosted',   pts: '−1'  },
  { id: 'INTERVIEW', label: 'Interview', pts: '+8'  },
  { id: 'OFFER',     label: 'Offer',     pts: '+18' },
];

const TAG_OPTIONS = [
  { id: '',                label: 'Default'         },
  { id: 'MAYBE',           label: 'Maybe'           },
  { id: 'PROBABLY',        label: 'Probably'        },
  { id: 'FOR SURE',        label: 'For Sure'        },
  { id: 'ABSOLUTE CINEMA', label: 'Absolute Cinema' },
];

function QuickAdd({ onAdd }) {
  const [company,  setCompany]  = useStateSB('');
  const [jobTitle, setJobTitle] = useStateSB('');
  const [status,   setStatus]   = useStateSB('PENDING');
  const [tag,      setTag]      = useStateSB('');
  const [jobLink,  setJobLink]  = useStateSB('');
  const [location, setLocation] = useStateSB('');
  const [notes,    setNotes]    = useStateSB('');
  const [success,  setSuccess]  = useStateSB(false);
  const [loading,  setLoading]  = useStateSB(false);

  const showTag = status === 'INTERVIEW' || status === 'OFFER';

  const reset = () => {
    setCompany(''); setJobTitle(''); setTag('');
    setJobLink(''); setLocation(''); setNotes('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!company.trim() || loading) return;
    setLoading(true);
    onAdd && onAdd(
      { company, jobTitle, status, tag: showTag ? tag : '', jobLink, location, notes },
      () => { reset(); setLoading(false); setSuccess(true); setTimeout(() => setSuccess(false), 2200); },
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
          <div className="qa-status-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {STATUS_OPTIONS.map(o => (
              <button type="button" key={o.id}
                className={`qa-status${status === o.id ? ' active' : ''}`}
                onClick={() => setStatus(o.id)}
              >
                {o.label}
                <span className="pts">{o.pts}</span>
              </button>
            ))}
          </div>
        </div>
        {showTag && (
          <div>
            <label className="qa-label">Confidence</label>
            <select className="qa-input" value={tag} onChange={e => setTag(e.target.value)}
              style={{ cursor: 'pointer' }}>
              {TAG_OPTIONS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="qa-label">Job link</label>
          <input className="qa-input" type="url" placeholder="https://..."
            value={jobLink} onChange={e => setJobLink(e.target.value)} />
        </div>
        <div>
          <label className="qa-label">Location</label>
          <input className="qa-input" placeholder="e.g. Berlin, Remote"
            value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div>
          <label className="qa-label">Notes</label>
          <textarea className="qa-input" placeholder="Any notes about this application…"
            value={notes} onChange={e => setNotes(e.target.value)}
            rows="3"
            style={{ resize: 'vertical', minHeight: 64, fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 1.5 }} />
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

window.WeeklyGoal  = WeeklyGoal;
window.QuickAdd    = QuickAdd;
window.NewListings = function() { return null; };
