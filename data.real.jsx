// data.real.jsx — production data adapter
// Reads window.__INIT_DATA__ (injected by PHP) and exposes the same
// globals as data.jsx so chart.jsx / leaderboard.jsx work unchanged.

const AVATAR_COLORS = [
  "#22c55e","#f59e0b","#3b82f6","#ec4899",
  "#8b5cf6","#06b6d4","#ef4444","#14b8a6",
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

// ── Build CHART_HISTORY (date-aligned, daily granularity) ────────────────────
// All users share the same __dates array. Scores are carried forward from
// the last known event so the chart accurately reflects when data was entered.
const CHART_HISTORY = (() => {
  const histByUser = {};
  (_d.scoreHistory || []).forEach(entry => {
    histByUser[entry.username] = entry.points; // [{date: "YYYY-MM-DD", score: number}]
  });

  // Union of all dates + today + yesterday (guarantees ≥2 points even with no data)
  const allDates = new Set();
  const todayStr     = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  allDates.add(todayStr);
  allDates.add(yesterdayStr);
  Object.values(histByUser).forEach(pts => pts.forEach(p => allDates.add(p.date)));

  const sortedDates = [...allDates].sort(); // ascending "YYYY-MM-DD"

  const out = { __dates: sortedDates };

  USERS.forEach(u => {
    const pts = histByUser[u.id] || [];
    const scoreMap = {};
    pts.forEach(p => { scoreMap[p.date] = p.score; });

    // Carry forward the last known score for each date
    let lastScore = 0;
    out[u.id] = sortedDates.map(date => {
      if (scoreMap[date] !== undefined) lastScore = scoreMap[date];
      return lastScore;
    });
  });

  return out;
})();

const ROLES       = ['All'];
const TIME_RANGES = ['1M', '3M', '6M', 'ALL'];
const POINTS      = { PENDING: 2, REJECTED: -1, GHOSTED: -1, INTERVIEW: 8, OFFER: 18 };

function calcScore(u) {
  return u.pending * 2 - u.rejected - u.ghosted + u.interviews * 8 + u.offers * 18;
}

Object.assign(window, {
  USERS, ROLES, CHART_HISTORY, TIME_RANGES, POINTS, calcScore, BASE_PATH, CURRENT_USER,
});
