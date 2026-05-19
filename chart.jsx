// Score evolution chart — multi-line, area-focus, bars
// CHART_HISTORY.__dates = sorted "YYYY-MM-DD" array (daily granularity)
// CHART_EVENTS[userId][dateIdx] = null | [{status, cnt}]

const { useState, useRef } = React;

const CHART_STYLES = [
  { id: 'multi', label: 'Multi-line' },
  { id: 'area',  label: 'Focus area' },
  { id: 'bars',  label: 'Bar race'   },
];

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const RANGE_DAYS = { '1M': 30, '3M': 90, '6M': 180 };

// Point values shown in tooltip (approximate — ignores tag multiplier for INTERVIEW/OFFER)
const STATUS_PTS = { PENDING: '+2', REJECTED: '−1', GHOSTED: '−1', INTERVIEW: '~8', OFFER: '~18' };

function ScoreChart({ currentUserId, mode, setMode, range, setRange, singleUser = false }) {
  const [hovered,  setHovered]  = useState(null);
  const [mutedIds, setMutedIds] = useState(new Set());
  const svgRef = useRef(null);

  const dates       = CHART_HISTORY.__dates || [];
  const totalPoints = dates.length;

  const visibleStyles = singleUser ? CHART_STYLES.filter(s => s.id !== 'multi') : CHART_STYLES;
  const effectiveMode = (singleUser && mode === 'multi') ? 'area' : mode;
  const chartUsers    = singleUser ? USERS.filter(u => u.id === currentUserId) : USERS;

  // Calendar-based range → startIdx
  const startIdx = (() => {
    if (range === 'ALL' || !RANGE_DAYS[range] || totalPoints === 0) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const idx = dates.findIndex(d => d >= cutoffStr);
    return idx === -1 ? 0 : idx;
  })();

  const visibleCount = Math.max(2, totalPoints - startIdx);

  const W = 720, H = 240, padL = 36, padR = 14, padT = 16, padB = 28;

  const allValues = chartUsers.flatMap(u => (CHART_HISTORY[u.id] || []).slice(startIdx));
  const maxV = Math.max(0, ...allValues);
  const yMax = Math.max(20, Math.ceil(maxV / 20) * 20);

  const xOf = (i) => visibleCount <= 1
    ? padL + (W - padL - padR) / 2
    : padL + (i / (visibleCount - 1)) * (W - padL - padR);
  const yOf = (v) => padT + (1 - v / yMax) * (H - padT - padB);

  const orderedUsers = singleUser
    ? chartUsers
    : [...USERS].sort((a, b) => (a.id === currentUserId ? 1 : b.id === currentUserId ? -1 : 0));

  const toggleMute = (id) => setMutedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const xLabels   = dates.slice(startIdx).map(fmtDate);
  const labelEvery = Math.max(1, Math.ceil(visibleCount / 8));
  const yTicks    = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMax * t));

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (x - padL) / (W - padL - padR);
    const idx = Math.max(0, Math.min(visibleCount - 1, Math.round(ratio * (visibleCount - 1))));
    setHovered({ idx, screenX: e.clientX - rect.left });
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
    return `${top} L${xOf(data.length-1).toFixed(2)},${yOf(0)} L${xOf(0).toFixed(2)},${yOf(0)} Z`;
  };

  // Render per-user event nodes (visible circles only on days with events)
  const renderNodes = (u, isMe, muted) => {
    const color = isMe ? 'var(--accent)' : u.color;
    return (CHART_HISTORY[u.id] || []).slice(startIdx).map((v, i) => {
      const hasEvent = !!(CHART_EVENTS?.[u.id]?.[startIdx + i]);
      const isHov    = hovered?.idx === i;
      if (!hasEvent && !isHov) return null;
      return (
        <circle key={`node-${i}`}
          cx={xOf(i)} cy={yOf(v)}
          r={isHov ? 5 : 3}
          fill={isHov ? color : 'var(--surface)'}
          stroke={color} strokeWidth="2"
          opacity={muted ? 0 : 1}
        />
      );
    });
  };

  const rangeDesc = range === 'ALL'
    ? `all ${visibleCount} days`
    : `last ${visibleCount} day${visibleCount !== 1 ? 's' : ''}`;

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
                onClick={() => setMode(s.id)}>{s.label}
              </button>
            ))}
          </div>
          <div className="range-pills">
            {TIME_RANGES.map(r => (
              <button key={r} className={`range-pill ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}>{r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-svg-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
          preserveAspectRatio="none"
          onMouseMove={handleMove} onMouseLeave={handleLeave}
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

          {/* x labels — actual dates */}
          {xLabels.map((lab, i) => (i % labelEvery === 0) && (
            <text key={i} x={xOf(i)} y={H-8} textAnchor="middle" fontSize="10"
              fill="var(--text-3)" fontFamily="var(--font-mono)">{lab}</text>
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
                  stroke={isMe ? 'var(--accent)' : u.color}
                  strokeWidth={isMe ? 3 : 1.7}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={isMe ? 1 : 0.7} />
                {renderNodes(u, isMe, muted)}
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
                {renderNodes(USERS.find(u => u.id === currentUserId) || { id: currentUserId }, true, false)}
              </>
            );
          })()}

          {/* ── BARS ── */}
          {effectiveMode === 'bars' && (() => {
            const barW = (W - padL - padR) / visibleCount * 0.55;
            return (CHART_HISTORY[currentUserId] || []).slice(startIdx).map((v, i) => {
              const x = xOf(i) - barW / 2;
              const y = yOf(v);
              const h = Math.max(0, (H - padT - padB) - (y - padT));
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={h} rx="4"
                    fill="var(--accent)"
                    opacity={hovered?.idx === i ? 1 : 0.85} />
                  {h > 14 && (
                    <text x={xOf(i)} y={y-5} textAnchor="middle" fontSize="9.5"
                      fontFamily="var(--font-mono)" fill="var(--text-2)">{v}</text>
                  )}
                </g>
              );
            });
          })()}

          {/* hover line */}
          {hovered && (
            <line x1={xOf(hovered.idx)} x2={xOf(hovered.idx)} y1={padT} y2={H-padB}
              stroke="var(--text)" strokeOpacity="0.18" strokeDasharray="2,3" />
          )}
        </svg>

        {/* ── TOOLTIP ── */}
        {hovered && (() => {
          const absIdx   = startIdx + hovered.idx;
          const dateLabel = fmtDate(dates[absIdx]);

          const list = effectiveMode === 'multi'
            ? [...USERS]
                .sort((a,b) => (CHART_HISTORY[b.id]?.[absIdx] || 0) - (CHART_HISTORY[a.id]?.[absIdx] || 0))
                .slice(0, 4)
            : [USERS.find(u => u.id === currentUserId)].filter(Boolean);

          return (
            <div className="chart-tip"
              style={{ left: (hovered.screenX / svgRef.current.getBoundingClientRect().width) * 100 + '%', top: 8 }}>
              <div style={{ fontWeight: 700, opacity: 0.8, marginBottom: 4 }}>{dateLabel}</div>
              {list.map(u => {
                const score     = CHART_HISTORY[u.id]?.[absIdx] ?? 0;
                const prevScore = absIdx > 0 ? (CHART_HISTORY[u.id]?.[absIdx - 1] ?? 0) : 0;
                const delta     = score - prevScore;
                const events    = CHART_EVENTS?.[u.id]?.[absIdx];
                const isMe      = u.id === currentUserId;
                return (
                  <div key={u.id} style={{ marginBottom: 5 }}>
                    <div className="row">
                      <span className="d" style={{ background: isMe ? 'var(--accent)' : u.color }}></span>
                      <span style={{ fontWeight: isMe ? 700 : 400 }}>{u.name}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{score}</span>
                      {delta !== 0 && (
                        <span style={{
                          marginLeft: 5, fontSize: 10, fontWeight: 600,
                          color: delta > 0 ? '#22c55e' : '#ef4444',
                        }}>
                          {delta > 0 ? '+' : ''}{delta}
                        </span>
                      )}
                    </div>
                    {events && (
                      <div style={{ paddingLeft: 14, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {events.map((ev, j) => (
                          <span key={j} style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            {ev.status} ×{ev.cnt}
                            {STATUS_PTS[ev.status] ? ` (${STATUS_PTS[ev.status]}p each)` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
