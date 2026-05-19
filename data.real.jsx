// data.real.jsx — production data adapter

// 12 distinct colors — accent green (#22c55e) intentionally excluded
// so the current-user highlight line never clashes with an avatar color.
const AVATAR_COLORS = [
  "#f59e0b",  // amber
  "#3b82f6",  // blue
  "#ec4899",  // pink
  "#8b5cf6",  // purple
  "#06b6d4",  // cyan
  "#ef4444",  // red
  "#f97316",  // orange
  "#14b8a6",  // teal
  "#a855f7",  // violet
  "#eab308",  // yellow
  "#0ea5e9",  // sky
  "#64748b",  // slate
];

const _d = window.__INIT_DATA__ || {};
const BASE_PATH    = _d.basePath   || '';
const CURRENT_USER = _d.currentUser || {};

// Sample n evenly-spaced cumulative scores — used only for sparklines (hist)
function samplePoints(points, n) {
  if (!points || points.length === 0) return Array(n).fill(0);
  if (points.length === 1) return Array(n).fill(points[0].score);
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round((i / (n - 1)) * (points.length - 1));
    return points[Math.min(idx, points.length - 1)].score;
  });
}

// ── Build USERS ──────────────────────────────────────────────────────────────
const USERS = (_d.leaderboard || []).map((u, i) => {
  const histEntry = (_d.scoreHistory || []).find(h => h.username === u.username);
  return {
    id:           u.username,
    name:         u.username,
    handle:       '@' + u.username,
    role:         'Intern Tracker',
    color:        AVATAR_COLORS[i % AVATAR_COLORS.length],
    pending:      parseInt(u.pending)            || 0,
    rejected:     parseInt(u.rejected)           || 0,
    ghosted:      parseInt(u.ghosted)            || 0,
    interviews:   parseInt(u.interviews)         || 0,
    offers:       parseInt(u.offers)             || 0,
    sent:         parseInt(u.total_applications) || 0,
    score:        parseInt(u.score)              || 0,
    applications: u.applications                 || [],
    hist:         samplePoints(histEntry ? histEntry.points : [], 8),
  };
});

// ── Build chart series from individual score events ──────────────────────────
// Each status-history row is one point. The leaderboard chart uses a global
// event axis, while the dashboard can use each user's own event-only series.
const CHART_HISTORY = (() => {
  const histByUser = {};
  const eventMeta = new Map();
  (_d.scoreHistory || []).forEach(entry => {
    histByUser[entry.username] = (entry.points || []).map((p, idx) => {
      const key = p.key || p.date || `${entry.username}-${idx}`;
      const point = {
        key,
        order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx,
        label: p.time || p.date || key,
        score: Number(p.score) || 0,
      };
      eventMeta.set(key, {
        key,
        order: point.order,
        label: point.label,
      });
      return point;
    });
  });

  eventMeta.set('__start', { key: '__start', order: -1, label: 'Start' });
  if (eventMeta.size === 1) {
    eventMeta.set('__empty', { key: '__empty', order: 0, label: 'Now' });
  }

  const sortedEvents = [...eventMeta.values()].sort((a, b) =>
    a.order - b.order || a.key.localeCompare(b.key)
  );

  const out = {
    __keys: sortedEvents.map(p => p.key),
    __dates: sortedEvents.map(p => p.label),
  };

  USERS.forEach(u => {
    const pts = histByUser[u.id] || [];
    const scoreMap = {};
    pts.forEach(p => { scoreMap[p.key] = p.score; });

    let lastScore = 0;
    out[u.id] = sortedEvents.map(point => {
      if (scoreMap[point.key] !== undefined) lastScore = scoreMap[point.key];
      return lastScore;
    });
  });

  return out;
})();

// ── Build CHART_EVENTS (global event-axis tooltip data) ──────────────────────
// Each entry is null or the exact score event(s) for that axis point.
const CHART_EVENTS = (() => {
  const evByUser = _d.scoreEvents || {};
  const keys = CHART_HISTORY.__keys;
  const out = {};

  USERS.forEach(u => {
    const byKey = evByUser[u.id] || {};
    out[u.id] = keys.map(key => byKey[key] || null);
  });

  return out;
})();

const CHART_USER_SERIES = (() => {
  const histByUser = {};
  (_d.scoreHistory || []).forEach(entry => {
    histByUser[entry.username] = (entry.points || []).map((p, idx) => ({
      key: p.key || p.date || `${entry.username}-${idx}`,
      order: Number.isFinite(Number(p.order)) ? Number(p.order) : idx,
      label: p.time || p.date || p.key || `${entry.username}-${idx}`,
      score: Number(p.score) || 0,
    })).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  });

  const evByUser = _d.scoreEvents || {};
  const out = {};
  USERS.forEach(u => {
    const points = [
      { key: '__start', order: -1, label: 'Start', score: 0 },
      ...(histByUser[u.id] || []),
    ];
    if (points.length === 1) points.push({ key: '__empty', order: 0, label: 'Now', score: 0 });
    const byKey = evByUser[u.id] || {};
    out[u.id] = points.map(point => ({
      ...point,
      events: byKey[point.key] || null,
    }));
  });
  return out;
})();

const ROLES       = ['All'];
const POINTS      = { PENDING: 2, REJECTED: -1, GHOSTED: -1, INTERVIEW: 8, OFFER: 18 };

function calcScore(u) {
  return u.pending * 2 - u.rejected - u.ghosted + u.interviews * 8 + u.offers * 18;
}

Object.assign(window, {
  USERS, ROLES, CHART_HISTORY, CHART_EVENTS, CHART_USER_SERIES, POINTS, calcScore, BASE_PATH, CURRENT_USER,
});
