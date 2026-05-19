// Mock data for the internship tracker
// Score = pending*2 + rejected*1 + ghosted*1 + interviews*10 + offers*20

const POINTS = {
  pending: 2, rejected: 1, ghosted: 1, interviews: 10, offers: 20
};

function calcScore(u) {
  return u.pending * POINTS.pending
       + u.rejected * POINTS.rejected
       + u.ghosted * POINTS.ghosted
       + u.interviews * POINTS.interviews
       + u.offers * POINTS.offers;
}

// 8 users — Basti highlighted as the current user
const USERS_RAW = [
  { id: 'basti',   name: 'Basti',    handle: '@basti',     role: 'SWE Intern',   color: '#22c55e', pending: 11, rejected: 7,  ghosted: 5, interviews: 4, offers: 1, sent: 28 },
  { id: 'mira',    name: 'Mira K.',  handle: '@mira',      role: 'Data Science', color: '#f59e0b', pending: 9,  rejected: 11, ghosted: 8, interviews: 5, offers: 2, sent: 35 },
  { id: 'leo',     name: 'Leo S.',   handle: '@leos',      role: 'ML Research',  color: '#3b82f6', pending: 14, rejected: 9,  ghosted: 6, interviews: 3, offers: 1, sent: 33 },
  { id: 'anya',    name: 'Anya P.',  handle: '@anya',      role: 'Product',      color: '#ec4899', pending: 7,  rejected: 14, ghosted: 9, interviews: 4, offers: 0, sent: 34 },
  { id: 'noah',    name: 'Noah W.',  handle: '@noah',      role: 'SWE Intern',   color: '#8b5cf6', pending: 12, rejected: 5,  ghosted: 4, interviews: 2, offers: 1, sent: 24 },
  { id: 'lina',    name: 'Lina O.',  handle: '@lina',      role: 'Design',       color: '#06b6d4', pending: 6,  rejected: 8,  ghosted: 4, interviews: 3, offers: 0, sent: 21 },
  { id: 'kai',     name: 'Kai T.',   handle: '@kait',      role: 'SWE Intern',   color: '#ef4444', pending: 8,  rejected: 6,  ghosted: 7, interviews: 1, offers: 0, sent: 22 },
  { id: 'eva',     name: 'Eva R.',   handle: '@evar',      role: 'Data Science', color: '#14b8a6', pending: 5,  rejected: 10, ghosted: 6, interviews: 2, offers: 0, sent: 23 },
];

// Add score + spark history (last 8 weeks)
const USERS = USERS_RAW.map(u => {
  const score = calcScore(u);
  // Deterministic-ish spark from id hash
  const seed = u.id.charCodeAt(0) + u.id.charCodeAt(u.id.length - 1);
  const hist = Array.from({ length: 8 }, (_, i) => {
    const base = (i + 1) / 8;
    const wobble = Math.sin((seed + i) * 1.7) * 0.08;
    return Math.max(0, Math.round(score * (base + wobble)));
  });
  hist[hist.length - 1] = score;
  return { ...u, score, hist };
});

const ROLES = ['All', 'SWE Intern', 'Data Science', 'ML Research', 'Product', 'Design'];

// Mock LinkedIn listings (original — not branded)
const LISTINGS = [
  { id: 1, company: 'Lumen Labs',     logo: 'L', color: '#22c55e', title: 'Software Engineer Intern, Summer 2026', loc: 'Berlin, DE · Hybrid', salary: '€2,800/mo', tags: ['Remote OK', 'Python'], hot: true,  when: '3m ago', applicants: '14 applicants' },
  { id: 2, company: 'Northwind AI',   logo: 'N', color: '#3b82f6', title: 'ML Research Intern',                    loc: 'Zurich, CH · On-site', salary: 'CHF 3,400/mo', tags: ['PyTorch'], hot: false, when: '12m ago', applicants: '32 applicants' },
  { id: 3, company: 'Atlas Tools',    logo: 'A', color: '#f59e0b', title: 'Frontend Engineering Intern',           loc: 'Remote · EU', salary: '€2,400/mo', tags: ['React', 'TS'], hot: false, when: '34m ago', applicants: '8 applicants' },
  { id: 4, company: 'Pinecrest',      logo: 'P', color: '#ec4899', title: 'Product Design Intern',                 loc: 'Amsterdam, NL', salary: '€2,200/mo', tags: ['Figma'], hot: true, when: '1h ago', applicants: '21 applicants' },
  { id: 5, company: 'Helio Robotics', logo: 'H', color: '#8b5cf6', title: 'Computer Vision Intern',                loc: 'Munich, DE', salary: '€3,000/mo', tags: ['C++', 'CV'], hot: false, when: '2h ago', applicants: '6 applicants' },
];

const TIME_RANGES = ['1M', '3M', '6M', 'ALL'];

// 12 weeks of score history for the line chart, indexed by user id
function buildChartHistory() {
  const weeks = 12;
  const out = {};
  USERS.forEach(u => {
    const final = u.score;
    const seed = u.id.charCodeAt(0) * 13 + u.id.charCodeAt(u.id.length - 1);
    const arr = [];
    let s = Math.max(4, Math.round(final * 0.18));
    for (let i = 0; i < weeks; i++) {
      const t = i / (weeks - 1);
      // base growth to final + sinusoidal wobble
      const target = s + (final - s) * t;
      const wobble = Math.sin((seed + i * 2.3)) * (final * 0.05);
      const v = i === weeks - 1 ? final : Math.max(0, Math.round(target + wobble));
      arr.push(v);
    }
    out[u.id] = arr;
  });
  return out;
}
const CHART_HISTORY = buildChartHistory();

Object.assign(window, { USERS, ROLES, LISTINGS, TIME_RANGES, CHART_HISTORY, POINTS, calcScore });
