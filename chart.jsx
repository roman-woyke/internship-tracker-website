// Score evolution chart — multi-line, area-focus, bars.
// Points are positioned on a real time axis; each status-history row is one node.

const { useState, useRef } = React;

const CHART_STYLES = [
  { id: 'multi', label: 'Multi-line' },
  { id: 'area',  label: 'Focus area' },
  { id: 'bars',  label: 'Bar race'   },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function parseChartTime(value) {
  if (!value || value === 'Start' || value === 'Now') return null;
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDayTime(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDate(dateStr) {
  const d = parseChartTime(dateStr);
  if (!d) return dateStr || '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDay(ms) {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtTag(tag) {
  if (!tag) return '';
  return tag.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function signedPoints(delta) {
  const n = Number(delta) || 0;
  return `${n > 0 ? '+' : ''}${n}p`;
}

function ScoreChart({ currentUserId, mode, setMode, singleUser = false }) {
  const [hovered,  setHovered]  = useState(null);
  const [mutedIds, setMutedIds] = useState(new Set());
  const svgRef = useRef(null);

  const visibleStyles = singleUser ? CHART_STYLES.filter(s => s.id !== 'multi') : CHART_STYLES;
  const effectiveMode = (singleUser && mode === 'multi') ? 'area' : mode;
  const chartUsers    = singleUser ? USERS.filter(u => u.id === currentUserId) : USERS;

  const rawSeries = (id) => (CHART_USER_SERIES?.[id] || [])
    .map(p => ({ ...p, ts: parseChartTime(p.label)?.getTime() ?? null }))
    .filter(p => p.ts !== null && p.events)
    .sort((a, b) => a.ts - b.ts || String(a.key).localeCompare(String(b.key)));

  const allEvents = chartUsers.flatMap(u => rawSeries(u.id));
  const now = Date.now();
  const minTs = allEvents.length ? Math.min(...allEvents.map(p => p.ts)) : now;
  const maxTs = allEvents.length ? Math.max(...allEvents.map(p => p.ts)) : now;
  const domainStart = startOfDayTime(minTs);
  let domainEnd = startOfDayTime(maxTs) + DAY_MS;
  if (domainEnd <= domainStart) domainEnd = domainStart + DAY_MS;

  const dayTicks = [];
  for (let t = domainStart; t <= domainEnd; t += DAY_MS) dayTicks.push(t);

  const timelineFor = (id) => {
    const events = rawSeries(id);
    const lastScore = events.length ? events[events.length - 1].score : 0;
    return [
      { key: '__start', ts: domainStart, score: 0, events: null, label: 'Start' },
      ...events,
      { key: '__end', ts: domainEnd, score: lastScore, events: null, label: 'Now' },
    ];
  };

  const W = 720, H = 240, padL = 36, padR = 14, padT = 16, padB = 34;

  const allValues = chartUsers.flatMap(u => timelineFor(u.id).map(p => p.score));
  const minV = Math.min(0, ...allValues);
  const maxV = Math.max(0, ...allValues);
  const yMin = Math.floor(minV / 10) * 10;
  const yMax = Math.max(20, Math.ceil(maxV / 20) * 20);
  const ySpan = Math.max(1, yMax - yMin);

  const xOfTime = (ts) => padL + ((ts - domainStart) / (domainEnd - domainStart)) * (W - padL - padR);
  const yOf = (v) => padT + (1 - ((v - yMin) / ySpan)) * (H - padT - padB);

  const orderedUsers = singleUser
    ? chartUsers
    : [...USERS].sort((a, b) => (a.id === currentUserId ? 1 : b.id === currentUserId ? -1 : 0));

  const toggleMute = (id) => setMutedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMin + ySpan * t));

  const handleLeave = () => setHovered(null);

  const linePath = (id) => {
    const data = timelineFor(id);
    if (data.length < 2) return '';
    return data.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${xOfTime(p.ts).toFixed(2)},${yOf(p.score).toFixed(2)}`
    ).join(' ');
  };

  const areaPath = (id) => {
    const data = timelineFor(id);
    if (data.length < 2) return '';
    const top = linePath(id);
    const first = data[0];
    const last = data[data.length - 1];
    return `${top} L${xOfTime(last.ts).toFixed(2)},${yOf(0).toFixed(2)} L${xOfTime(first.ts).toFixed(2)},${yOf(0).toFixed(2)} Z`;
  };

  const renderNodes = (u, muted) => {
    const color = effectiveMode === 'multi' ? u.color : 'var(--accent)';
    return rawSeries(u.id).map(p => {
      const x = xOfTime(p.ts);
      const y = yOf(p.score);
      const isHov = hovered?.userId === u.id && hovered?.key === p.key;
      return (
        <g key={p.key}
           onMouseEnter={() => setHovered({ userId: u.id, key: p.key, point: p, x })}
           style={{ cursor: 'pointer' }}>
          <circle cx={x} cy={y} r="9" fill="transparent" />
          <circle
            cx={x} cy={y}
            r={isHov ? 5 : 3}
            fill={isHov ? color : 'var(--surface)'}
            stroke={color} strokeWidth="2"
            opacity={muted ? 0 : 1}
            pointerEvents="none"
          />
        </g>
      );
    });
  };

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Sparkle size={15} /> Score evolution</h3>
          <p className="card-subtitle">
            {singleUser ? 'Your score evolution' : 'Score across all tracked applicants'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div className="chart-tabs">
            {visibleStyles.map(s => (
              <button key={s.id}
                className={`chart-tab ${effectiveMode === s.id ? 'active' : ''}`}
                onClick={() => setMode(s.id)}>{s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
          preserveAspectRatio="none"
          onMouseLeave={handleLeave}
          style={{ display: 'block', overflow: 'visible' }}>

          {/* y grid */}
          {yTicks.map((tv, i) => (
            <g key={i}>
              <line x1={padL} x2={W-padR} y1={yOf(tv)} y2={yOf(tv)}
                stroke="var(--border)" strokeDasharray={i === 0 ? '' : '3,4'} />
              <text x={padL-8} y={yOf(tv)+4} textAnchor="end" fontSize="10"
                fill="var(--text-3)" fontFamily="var(--font-mono)">{tv}</text>
            </g>
          ))}

          {/* day-by-day x axis */}
          {dayTicks.map(t => (
            <g key={t}>
              <line x1={xOfTime(t)} x2={xOfTime(t)} y1={padT} y2={H-padB}
                stroke="var(--border)" strokeOpacity="0.55" strokeDasharray="2,6" />
              <text x={xOfTime(t)} y={H-10} textAnchor="middle" fontSize="9"
                fill="var(--text-3)" fontFamily="var(--font-mono)">{fmtDay(t)}</text>
            </g>
          ))}

          {/* ── MULTI-LINE ── */}
          {effectiveMode === 'multi' && orderedUsers.map(u => {
            const isMe  = u.id === currentUserId;
            const muted = mutedIds.has(u.id);
            const lp    = linePath(u.id);
            if (!lp) return null;
            return (
              <g key={u.id} opacity={muted ? 0.08 : 1} style={{ transition: 'opacity 0.2s' }}>
                <path d={lp} fill="none"
                  stroke={u.color}
                  strokeWidth={isMe ? 3 : 1.7}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={isMe ? 1 : 0.7} />
                {renderNodes(u, muted)}
              </g>
            );
          })}

          {/* ── AREA FOCUS ── */}
          {effectiveMode === 'area' && (() => {
            const ap = areaPath(currentUserId);
            const lp = linePath(currentUserId);
            return (
              <>
                {!singleUser && orderedUsers.filter(u => u.id !== currentUserId).map(u => {
                  const p = linePath(u.id);
                  return p && !mutedIds.has(u.id) && (
                    <path key={u.id} d={p} fill="none" stroke={u.color}
                      strokeWidth="1.3" opacity="0.28" />
                  );
                })}
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {ap && <path d={ap} fill="url(#areaFill)" />}
                {lp && <path d={lp} fill="none" stroke="var(--accent)"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                {renderNodes(USERS.find(u => u.id === currentUserId) || { id: currentUserId }, false)}
              </>
            );
          })()}

          {/* ── BARS ── */}
          {effectiveMode === 'bars' && (() => {
            const eventPoints = rawSeries(currentUserId);
            const barW = Math.max(3, Math.min(20, (W - padL - padR) / Math.max(1, dayTicks.length) * 0.18));
            return eventPoints.map(p => {
              const x = xOfTime(p.ts) - barW / 2;
              const y = yOf(Math.max(0, p.score));
              const yZero = yOf(0);
              const h = Math.abs(yZero - yOf(p.score));
              const isHov = hovered?.userId === currentUserId && hovered?.key === p.key;
              return (
                <g key={p.key}
                   onMouseEnter={() => setHovered({ userId: currentUserId, key: p.key, point: p, x: xOfTime(p.ts) })}
                   style={{ cursor: 'pointer' }}>
                  <rect x={x} y={Math.min(y, yZero)} width={barW} height={Math.max(2, h)} rx="4"
                    fill="var(--accent)"
                    opacity={isHov ? 1 : 0.85} />
                </g>
              );
            });
          })()}

          {/* hover line */}
          {hovered && (
            <line x1={hovered.x} x2={hovered.x} y1={padT} y2={H-padB}
              stroke="var(--text)" strokeOpacity="0.18" strokeDasharray="2,3" />
          )}
        </svg>

        {/* ── TOOLTIP ── */}
        {hovered && (() => {
          const u = USERS.find(user => user.id === hovered.userId);
          const point = hovered.point;
          const events = point?.events;
          if (!u || !events) return null;
          const delta = events.reduce((sum, ev) => sum + (Number(ev.delta) || 0), 0);
          const isMe = u.id === currentUserId;

          return (
            <div className="chart-tip"
              style={{ left: (hovered.x / W) * 100 + '%', top: 8 }}>
              <div style={{ fontWeight: 700, opacity: 0.8, marginBottom: 4 }}>{fmtDate(point.label)}</div>
              <div style={{ marginBottom: 5 }}>
                <div className="row">
                  <span className="d" style={{ background: effectiveMode === 'multi' ? u.color : 'var(--accent)' }}></span>
                  <span style={{ fontWeight: isMe ? 700 : 400 }}>{u.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{point.score}</span>
                  {delta !== 0 && (
                    <span style={{
                      marginLeft: 5, fontSize: 10, fontWeight: 600,
                      color: delta > 0 ? '#22c55e' : '#ef4444',
                    }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </div>
                <div style={{ paddingLeft: 14, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {events.map((ev, j) => (
                    <span key={j} style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {ev.company ? `${ev.company}: ` : ''}{ev.status}
                      {ev.tag ? ` · ${fmtTag(ev.tag)}` : ''} ({signedPoints(ev.delta)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      {effectiveMode === 'multi' && (
        <div className="chart-legend">
          {USERS.map(u => {
            const muted = mutedIds.has(u.id);
            const isMe  = u.id === currentUserId;
            return (
              <span key={u.id}
                className={`legend-item ${muted ? 'muted' : ''} ${isMe ? 'me' : ''}`}
                onClick={() => toggleMute(u.id)}>
                <span className="swatch" style={{ background: u.color }}></span>
                {u.name}{isMe ? ' (you)' : ''}
              </span>
            );
          })}
        </div>
      )}
      {effectiveMode === 'area' && (
        <div className="chart-legend">
          <span className="legend-item me">
            <span className="swatch" style={{ background: 'var(--accent)' }}></span>
            {USERS.find(u => u.id === currentUserId)?.name}{singleUser ? '' : ' (focus)'}
          </span>
          {!singleUser && (
            <span className="legend-item" style={{ color: 'var(--text-3)' }}>Others shown faded</span>
          )}
        </div>
      )}
      {effectiveMode === 'bars' && (
        <div className="chart-legend">
          <span className="legend-item me">
            <span className="swatch" style={{ background: 'var(--accent)' }}></span>
            Cumulative score · {USERS.find(u => u.id === currentUserId)?.name}
          </span>
        </div>
      )}
    </div>
  );
}

window.ScoreChart  = ScoreChart;
window.CHART_STYLES = CHART_STYLES;
