// Score evolution chart — 3 styles: multi-line, area-focus, bars
// Uses USERS, CHART_HISTORY from data.jsx / data.real.jsx
// CHART_HISTORY.__dates is a sorted "YYYY-MM-DD" array (daily granularity).

const { useState, useMemo, useRef, useEffect } = React;

const CHART_STYLES = [
  { id: 'multi',  label: 'Multi-line' },
  { id: 'area',   label: 'Focus area' },
  { id: 'bars',   label: 'Bar race' },
];

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // "19 May"
}

// Days visible per range label
const RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180 };

function ScoreChart({ currentUserId, mode, setMode, range, setRange, singleUser = false }) {
  const [hovered, setHovered] = useState(null);
  const [mutedIds, setMutedIds] = useState(new Set());
  const svgRef = useRef(null);

  // Date-aligned history
  const dates = CHART_HISTORY.__dates || [];
  const totalPoints = dates.length;

  // When singleUser, only show area + bars (not multi)
  const visibleStyles = singleUser ? CHART_STYLES.filter(s => s.id !== 'multi') : CHART_STYLES;
  const effectiveMode = (singleUser && mode === 'multi') ? 'area' : mode;
  const chartUsers    = singleUser ? USERS.filter(u => u.id === currentUserId) : USERS;

  // Compute start index based on real calendar range
  const startIdx = (() => {
    if (range === 'ALL' || !RANGE_DAYS[range] || totalPoints === 0) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const idx = dates.findIndex(d => d >= cutoffStr);
    return idx === -1 ? 0 : idx;
  })();

  const visibleWeeks = Math.max(2, totalPoints - startIdx); // "weeks" kept for compat

  const W = 720;
  const H = 240;
  const padL = 36;
  const padR = 14;
  const padT = 16;
  const padB = 28;

  const allValues = chartUsers.flatMap(u => (CHART_HISTORY[u.id] || []).slice(startIdx));
  const maxV = Math.max(0, ...allValues);
  const yMax = Math.max(20, Math.ceil(maxV / 20) * 20);

  // Safe xOf: handles single-point edge case
  const xOf = (i) => visibleWeeks <= 1
    ? padL + (W - padL - padR) / 2
    : padL + (i / (visibleWeeks - 1)) * (W - padL - padR);
  const yOf = (v) => padT + (1 - v / yMax) * (H - padT - padB);

  const orderedUsers = singleUser
    ? chartUsers
    : [...USERS].sort((a, b) => (a.id === currentUserId ? 1 : b.id === currentUserId ? -1 : 0));

  const toggleMute = (id) => {
    setMutedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // x-axis labels: actual dates, spaced to show ~8 labels max
  const xLabels = dates.slice(startIdx).map(fmtDate);
  const labelEvery = Math.max(1, Math.ceil(visibleWeeks / 8));

  // y ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMax * t));

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (x - padL) / (W - padL - padR);
    const idx = Math.max(0, Math.min(visibleWeeks - 1, Math.round(ratio * (visibleWeeks - 1))));
    setHovered({ idx, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top });
  };
  const handleLeave = () => setHovered(null);

  const linePath = (id) => {
    const data = (CHART_HISTORY[id] || []).slice(startIdx);
    if (data.length < 2) return '';
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(' ');
  };

  const areaPath = (id) => {
    const data = (CHART_HISTORY[id] || []).slice(startIdx);
    if (data.length < 2) return '';
    const top = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(' ');
    return `${top} L${xOf(data.length - 1).toFixed(2)},${yOf(0)} L${xOf(0).toFixed(2)},${yOf(0)} Z`;
  };

  // Range description for subtitle
  const rangeDesc = range === 'ALL' ? `all ${visibleWeeks} days` : `last ${visibleWeeks} day${visibleWeeks !== 1 ? 's' : ''}`;

  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3 className="card-title"><Icon.Sparkle size={15} /> Score evolution</h3>
          <p className="card-subtitle">
            {singleUser ? 'Your score evolution' : 'Score across all tracked applicants'} — {rangeDesc}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div className="chart-tabs">
            {visibleStyles.map(s => (
              <button key={s.id}
                className={`chart-tab ${effectiveMode === s.id ? 'active' : ''}`}
                onClick={() => setMode(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="range-pills">
            {TIME_RANGES.map(r => (
              <button key={r} className={`range-pill ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* y grid */}
          {yTicks.map((tv, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={yOf(tv)} y2={yOf(tv)} stroke="var(--border)" strokeDasharray={i === 0 ? '' : '3,4'} />
              <text x={padL - 8} y={yOf(tv) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">{tv}</text>
            </g>
          ))}
          {/* x labels — actual dates */}
          {xLabels.map((lab, i) => (
            (i % labelEvery === 0) && (
              <text key={i} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="var(--font-mono)">{lab}</text>
            )
          ))}

          {/* ------- MODE: multi-line ------- */}
          {effectiveMode === 'multi' && orderedUsers.map(u => {
            const isMe = u.id === currentUserId;
            const muted = mutedIds.has(u.id);
            const p = linePath(u.id);
            if (!p) return null;
            return (
              <g key={u.id} opacity={muted ? 0.08 : 1} style={{ transition: 'opacity 0.2s' }}>
                <path d={p} fill="none"
                  stroke={isMe ? 'var(--accent)' : u.color}
                  strokeWidth={isMe ? 3 : 1.7}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={isMe ? 1 : 0.7}
                />
              </g>
            );
          })}

          {/* ------- MODE: area focus ------- */}
          {effectiveMode === 'area' && (() => {
            const ap = areaPath(currentUserId);
            const lp = linePath(currentUserId);
            return (
              <>
                {!singleUser && orderedUsers.filter(u => u.id !== currentUserId).map(u => {
                  const p = linePath(u.id);
                  return p && !mutedIds.has(u.id) && (
                    <path key={u.id} d={p} fill="none" stroke={u.color} strokeWidth="1.3" opacity="0.28" />
                  );
                })}
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {ap && <path d={ap} fill="url(#areaFill)" />}
                {lp && <path d={lp} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                {(CHART_HISTORY[currentUserId] || []).slice(startIdx).map((v, i) => (
                  <circle key={i} cx={xOf(i)} cy={yOf(v)} r="3" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
                ))}
              </>
            );
          })()}

          {/* ------- MODE: bars ------- */}
          {effectiveMode === 'bars' && (() => {
            const barW = (W - padL - padR) / visibleWeeks * 0.55;
            return (CHART_HISTORY[currentUserId] || []).slice(startIdx).map((v, i) => {
              const x = xOf(i) - barW / 2;
              const y = yOf(v);
              const h = (H - padT - padB) - (y - padT);
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx="4" fill="var(--accent)" opacity={hovered?.idx === i ? 1 : 0.85} />
                  {h > 14 && <text x={xOf(i)} y={y - 5} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--text-2)">{v}</text>}
                </g>
              );
            });
          })()}

          {/* hover line + dots */}
          {hovered && (
            <>
              <line x1={xOf(hovered.idx)} x2={xOf(hovered.idx)} y1={padT} y2={H - padB}
                stroke="var(--text)" strokeOpacity="0.18" strokeDasharray="2,3" />
              {effectiveMode !== 'bars' && orderedUsers
                .filter(u => !mutedIds.has(u.id) && (effectiveMode === 'multi' || u.id === currentUserId))
                .map(u => {
                  const v = (CHART_HISTORY[u.id] || [])[startIdx + hovered.idx];
                  if (v == null) return null;
                  return (
                    <circle key={u.id} cx={xOf(hovered.idx)} cy={yOf(v)}
                      r={u.id === currentUserId ? 5 : 3.5}
                      fill="var(--surface)"
                      stroke={u.id === currentUserId ? 'var(--accent)' : u.color}
                      strokeWidth="2" />
                  );
                })}
            </>
          )}
        </svg>

        {hovered && (() => {
          const list = effectiveMode === 'multi'
            ? [...USERS].sort((a,b) => (CHART_HISTORY[b.id]?.[startIdx + hovered.idx] || 0) - (CHART_HISTORY[a.id]?.[startIdx + hovered.idx] || 0)).slice(0, 4)
            : [USERS.find(u => u.id === currentUserId)].filter(Boolean);
          const dateLabel = fmtDate(dates[startIdx + hovered.idx]);
          return (
            <div className="chart-tip" style={{ left: (hovered.screenX / svgRef.current.getBoundingClientRect().width) * 100 + '%', top: 8 }}>
              <div style={{ fontWeight: 700, opacity: 0.8 }}>{dateLabel}</div>
              {list.map(u => (
                <div className="row" key={u.id}>
                  <span className="d" style={{ background: u.id === currentUserId ? 'var(--accent)' : u.color }}></span>
                  <span>{u.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{(CHART_HISTORY[u.id] || [])[startIdx + hovered.idx] ?? 0}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Legend */}
      {effectiveMode === 'multi' && (
        <div className="chart-legend">
          {USERS.map(u => {
            const muted = mutedIds.has(u.id);
            const isMe = u.id === currentUserId;
            return (
              <span key={u.id} className={`legend-item ${muted ? 'muted' : ''} ${isMe ? 'me' : ''}`} onClick={() => toggleMute(u.id)}>
                <span className="swatch" style={{ background: isMe ? 'var(--accent)' : u.color }}></span>
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
          {!singleUser && <span className="legend-item" style={{ color: 'var(--text-3)' }}>Others shown faded</span>}
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

window.ScoreChart = ScoreChart;
window.CHART_STYLES = CHART_STYLES;
