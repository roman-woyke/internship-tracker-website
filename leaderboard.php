<?php

require_once __DIR__ . "/includes/session.php";
require_once __DIR__ . "/includes/scoring.php";

$userId   = $_SESSION["user_id"];
$username = $_SESSION["username"];

// ── Fetch all users + stats ───────────────────────────────────────────
$stmt = $pdo->query("
    SELECT
        users.id AS user_id,
        users.username,
        COUNT(applications.id) AS total_applications,
        COALESCE(SUM(applications.status = 'PENDING'),   0) AS pending,
        COALESCE(SUM(applications.status = 'REJECTED'),  0) AS rejected,
        COALESCE(SUM(applications.status = 'GHOSTED'),   0) AS ghosted,
        COALESCE(SUM(applications.status = 'INTERVIEW'), 0) AS interviews,
        COALESCE(SUM(applications.status = 'OFFER'),     0) AS offers
    FROM users
    LEFT JOIN applications ON users.id = applications.user_id
    GROUP BY users.id, users.username
");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Compute scores ────────────────────────────────────────────────────
$histRows = $pdo->query("
    SELECT h.status, a.tag, a.user_id
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
")->fetchAll(PDO::FETCH_ASSOC);

$scoreByUser = [];
foreach ($histRows as $r) {
    $uid = $r["user_id"];
    $scoreByUser[$uid] = ($scoreByUser[$uid] ?? 0) + scorePoints($r["status"], $r["tag"]);
}
foreach ($users as &$u) {
    $u["score"] = $scoreByUser[$u["user_id"]] ?? 0;
}
unset($u);

usort($users, fn($a, $b) =>
    $b["score"]              <=> $a["score"] ?:
    $b["offers"]             <=> $a["offers"] ?:
    $b["interviews"]         <=> $a["interviews"] ?:
    $b["total_applications"] <=> $a["total_applications"]
);

$maxScore = max(array_column($users, "score") ?: [1]);
$myRank   = 1;
$myScore  = 0;
foreach ($users as $i => $u) {
    if ((int) $u["user_id"] === $userId) {
        $myRank  = $i + 1;
        $myScore = $u["score"];
        break;
    }
}

// ── Fetch all applications with peak status ───────────────────────────
$appRows = $pdo->query("
    SELECT a.user_id, a.id AS application_id,
           a.company_name, a.job_title, a.job_link, a.location,
           a.status, a.notes, a.tag, a.created_at, a.updated_at,
           " . peakStatusSql() . "
    FROM applications a
    LEFT JOIN application_status_history h ON h.application_id = a.id
    GROUP BY a.id, a.user_id, a.company_name, a.job_title, a.job_link,
             a.location, a.status, a.notes, a.tag, a.created_at, a.updated_at
    ORDER BY a.created_at DESC
")->fetchAll(PDO::FETCH_ASSOC);

$appsByUser = [];
foreach ($appRows as $app) {
    $appsByUser[$app["user_id"]][] = $app;
}
foreach ($users as &$u) {
    $u["applications"] = $appsByUser[$u["user_id"]] ?? [];
}
unset($u);

// ── Helpers ───────────────────────────────────────────────────────────
function tagBadge(?string $tag): string {
    if (empty($tag)) return "";
    $slug = strtolower(str_replace(' ', '-', $tag));
    return '<span class="tag-badge tag-badge-' . $slug . '">' . htmlspecialchars($tag) . '</span>';
}

$avatarColors = ["#22c55e","#f59e0b","#3b82f6","#ec4899","#8b5cf6","#06b6d4","#ef4444","#14b8a6"];
$rankMedals   = ["🥇","🥈","🥉"];

require_once __DIR__ . "/includes/header.php";
?>

<!-- ══════════════════════════════════════════════════════════
     STAT STRIP
════════════════════════════════════════════════════════════ -->
<div class="stats-row">

    <div class="stat featured">
        <span class="stat-rank">RANK #<?= $myRank ?></span>
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/></svg>
            Your position
        </div>
        <div class="stat-value">#<?= $myRank ?></div>
        <div class="stat-foot">out of <?= count($users) ?> competitors</div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            Your score
        </div>
        <div class="stat-value"><?= $myScore ?></div>
        <div class="stat-foot">pts total</div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Leading score
        </div>
        <div class="stat-value"><?= $users[0]["score"] ?? 0 ?></div>
        <div class="stat-foot"><?= htmlspecialchars($users[0]["username"] ?? "—") ?></div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            Total applications
        </div>
        <div class="stat-value"><?= array_sum(array_column($users, "total_applications")) ?></div>
        <div class="stat-foot">across all trackers</div>
    </div>

</div>

<!-- ══════════════════════════════════════════════════════════
     LEADERBOARD TABLE
════════════════════════════════════════════════════════════ -->
<div class="card" style="margin-bottom:20px;">
    <div class="card-head">
        <div>
            <h3 class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/></svg>
                Leaderboard
            </h3>
            <p class="card-subtitle">Click a row to see that person's applications</p>
        </div>
        <span class="live-pill"><span class="live-dot"></span>Live</span>
    </div>

    <div style="overflow-x:auto;">
    <table class="lb-table">
        <thead>
            <tr>
                <th style="width:52px;">#</th>
                <th>User</th>
                <th class="num">Score</th>
                <th class="num">Sent</th>
                <th class="num">Interviews</th>
                <th class="num">Offers</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($users as $i => $u):
            $uid   = (int) $u["user_id"];
            $isMe  = $uid === $userId;
            $color = $avatarColors[$i % count($avatarColors)];
            $pct   = $maxScore > 0 ? round($u["score"] / $maxScore * 100) : 0;
        ?>

        <!-- Main row -->
        <tr onclick="toggleApps(<?= $uid ?>)" style="cursor:pointer;<?= $isMe ? 'background:color-mix(in srgb, var(--accent) 5%, transparent);' : '' ?>">
            <td style="font-size:18px; text-align:center; padding-left:8px;">
                <?php if ($i < 3): ?>
                    <?= $rankMedals[$i] ?>
                <?php else: ?>
                    <span style="color:var(--text-3); font-family:var(--font-mono); font-size:13px;">#<?= $i + 1 ?></span>
                <?php endif; ?>
            </td>
            <td>
                <div class="user-cell">
                    <div class="avatar" style="background:<?= $color ?>;"><?= strtoupper(mb_substr($u["username"], 0, 1)) ?></div>
                    <div>
                        <div class="uname"><?= htmlspecialchars($u["username"]) ?><?= $isMe ? ' <span style="font-size:10px;font-weight:600;color:var(--accent-strong);margin-left:4px;">you</span>' : '' ?></div>
                        <div class="urole"><?= $u["total_applications"] ?> applications</div>
                    </div>
                </div>
            </td>
            <td class="num">
                <div class="score-cell">
                    <div class="score-bar"><span style="width:<?= $pct ?>%;"></span></div>
                    <span style="font-family:var(--font-mono); font-weight:700;"><?= $u["score"] ?></span>
                </div>
            </td>
            <td class="num" style="color:var(--text-2);"><?= $u["total_applications"] ?></td>
            <td class="num" style="color:var(--text-2);"><?= $u["interviews"] ?></td>
            <td class="num" style="color:<?= $u["offers"] > 0 ? 'var(--accent-strong)' : 'var(--text-2)' ?>; font-weight:<?= $u["offers"] > 0 ? '700' : '400' ?>;"><?= $u["offers"] ?></td>
        </tr>

        <!-- Expandable applications row -->
        <tr id="apps-row-<?= $uid ?>" style="display:none;">
            <td colspan="6" style="padding:0; background:var(--surface-2);">
                <div style="padding:14px 20px 18px;">
                <?php if (empty($u["applications"])): ?>
                    <p style="color:var(--text-3); font-size:13px; margin:8px 0;">No applications yet.</p>
                <?php else: ?>
                    <table class="lb-table" style="font-size:12px; background:transparent;">
                        <thead>
                            <tr>
                                <th>Tag</th>
                                <th>Company</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Location</th>
                                <th>Link</th>
                                <th>Added</th>
                            </tr>
                        </thead>
                        <tbody>
                        <?php foreach ($u["applications"] as $app): ?>
                        <tr onclick="event.stopPropagation()">
                            <td><?= tagBadge($app["tag"]) ?></td>
                            <td style="font-weight:600;"><?= htmlspecialchars($app["company_name"]) ?></td>
                            <td style="color:var(--text-2);"><?= htmlspecialchars($app["job_title"] ?? "—") ?></td>
                            <td>
                                <?php if (!empty($app["peak_status"]) && $app["peak_status"] !== $app["status"] && in_array($app["peak_status"], ["INTERVIEW","OFFER"])): ?>
                                    <span style="font-size:10px; font-weight:700; color:var(--accent-strong);"><?= htmlspecialchars($app["peak_status"]) ?></span>
                                    <span style="opacity:.35; font-size:10px;"> ↓ </span>
                                <?php endif; ?>
                                <?= htmlspecialchars($app["status"]) ?>
                            </td>
                            <td style="color:var(--text-3);"><?= htmlspecialchars($app["location"] ?? "—") ?></td>
                            <td>
                                <?php if (!empty($app["job_link"])): ?>
                                    <a href="<?= htmlspecialchars($app["job_link"]) ?>" target="_blank"
                                       style="font-size:11px;" onclick="event.stopPropagation()">Open ↗</a>
                                <?php else: ?>—<?php endif; ?>
                            </td>
                            <td style="font-family:var(--font-mono); font-size:10px; color:var(--text-3); white-space:nowrap;"><?= date("d M", strtotime($app["created_at"])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php endif; ?>
                </div>
            </td>
        </tr>

        <?php endforeach; ?>
        </tbody>
    </table>
    </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SCORE CHART
════════════════════════════════════════════════════════════ -->
<div class="card chart-card">
    <div class="card-head">
        <div>
            <h3 class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                Score evolution
            </h3>
            <p class="card-subtitle">Daily cumulative score across all trackers</p>
        </div>
    </div>
    <div class="chart-svg-wrap" id="chart-wrap" style="min-height:240px;">
        <svg id="score-svg" width="100%" viewBox="0 0 720 240"
             preserveAspectRatio="none" style="display:block; overflow:visible;"
             onmousemove="chartMove(event)" onmouseleave="chartLeave()"></svg>
        <div id="chart-tip" class="chart-tip" style="display:none;"></div>
    </div>
    <div class="chart-legend" id="chart-legend"></div>
</div>

<script>
const BASE_PATH = "<?= BASE_PATH ?>";

// ── Row toggle ────────────────────────────────────────────────────────
function toggleApps(uid) {
    const row = document.getElementById("apps-row-" + uid);
    if (!row) return;
    row.style.display = row.style.display === "none" ? "table-row" : "none";
}

// ── Score chart ───────────────────────────────────────────────────────
const USER_COLORS = ["#22c55e","#f59e0b","#3b82f6","#ec4899","#8b5cf6","#06b6d4","#ef4444","#14b8a6"];
const ME = <?= json_encode($username) ?>;
let chartData = [];
let hoveredX  = null;

function buildChart(data) {
    if (!data || data.length === 0) return;
    chartData = data;

    const svg    = document.getElementById("score-svg");
    const legend = document.getElementById("chart-legend");
    const W = 720, H = 240, padL = 36, padR = 14, padT = 16, padB = 28;

    const allDates = new Set();
    data.forEach(u => u.points.forEach(p => allDates.add(p.date)));
    const sortedDates = [...allDates].sort();
    const maxScore    = Math.max(...data.flatMap(u => u.points.map(p => p.score)), 1);
    const yMax        = Math.ceil(maxScore / 20) * 20 || 20;

    const xOf = i => padL + (i / Math.max(1, sortedDates.length - 1)) * (W - padL - padR);
    const yOf = v => padT + (1 - v / yMax) * (H - padT - padB);
    const dateIdx = {};
    sortedDates.forEach((d, i) => dateIdx[d] = i);

    let svgHtml = "";

    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        const tv = Math.round(yMax * t);
        const y  = yOf(tv);
        svgHtml += `<line x1="${padL}" x2="${W-padR}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-dasharray="${t===0?'':'3,4'}"/>`;
        svgHtml += `<text x="${padL-8}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${tv}</text>`;
    });

    const labelEvery = sortedDates.length > 10 ? Math.ceil(sortedDates.length / 8) : 1;
    sortedDates.forEach((d, i) => {
        if (i % labelEvery !== 0) return;
        svgHtml += `<text x="${xOf(i)}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${d.slice(5)}</text>`;
    });

    const userPaths = data.map((u, ci) => {
        const isMe  = u.username === ME;
        const color = USER_COLORS[ci % USER_COLORS.length];
        let lastScore = 0;
        const expanded = sortedDates.map(d => {
            const pt = u.points.find(p => p.date === d);
            if (pt) lastScore = pt.score;
            return lastScore;
        });
        const d = expanded.map((v, i) => `${i===0?"M":"L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
        let areaPath = "";
        if (isMe) {
            const last = expanded.length - 1;
            areaPath = `${d} L${xOf(last).toFixed(2)},${yOf(0)} L${xOf(0).toFixed(2)},${yOf(0)} Z`;
        }
        return { username: u.username, color, isMe, d, areaPath, expanded };
    });

    userPaths.sort((a, b) => a.isMe ? 1 : b.isMe ? -1 : 0);

    svgHtml += `<defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>`;

    userPaths.forEach(u => {
        if (u.isMe && u.areaPath) svgHtml += `<path d="${u.areaPath}" fill="url(#areaG)"/>`;
        svgHtml += `<path d="${u.d}" fill="none" stroke="${u.color}"
            stroke-width="${u.isMe ? 3 : 1.7}" stroke-linecap="round" stroke-linejoin="round"
            opacity="${u.isMe ? 1 : 0.55}"/>`;
    });

    const meUser = userPaths.find(u => u.isMe);
    if (meUser) {
        meUser.expanded.forEach((v, i) => {
            svgHtml += `<circle cx="${xOf(i).toFixed(2)}" cy="${yOf(v).toFixed(2)}" r="3"
                fill="var(--surface)" stroke="var(--accent)" stroke-width="2" data-idx="${i}"/>`;
        });
    }

    svgHtml += `<rect id="chart-hover-zone" x="${padL}" y="${padT}" width="${W-padL-padR}" height="${H-padT-padB}" fill="transparent"/>`;
    svg.innerHTML = svgHtml;
    svg._meta = { xOf, yOf, sortedDates, userPaths, padL, padR, W };

    legend.innerHTML = userPaths.slice().reverse().map(u => `
        <span class="legend-item ${u.isMe ? 'me' : ''}" style="cursor:default;">
            <span class="swatch" style="background:${u.color};"></span>
            ${u.username}${u.isMe ? ' (you)' : ''}
        </span>`).join("");
}

function chartMove(e) {
    const svg = document.getElementById("score-svg");
    if (!svg._meta) return;
    const { xOf, yOf, sortedDates, userPaths, padL, padR, W } = svg._meta;
    const rect  = svg.getBoundingClientRect();
    const xRel  = (e.clientX - rect.left) / rect.width * W;
    const ratio = (xRel - padL) / (W - padL - padR);
    const idx   = Math.max(0, Math.min(sortedDates.length - 1, Math.round(ratio * (sortedDates.length - 1))));
    if (idx === hoveredX) return;
    hoveredX = idx;
    const tip  = document.getElementById("chart-tip");
    const date = sortedDates[idx];
    const rows = [...userPaths].sort((a, b) => b.expanded[idx] - a.expanded[idx]).slice(0, 5);
    tip.innerHTML = `<div style="font-weight:700; opacity:.8; margin-bottom:3px;">${date}</div>` +
        rows.map(u => `<div class="tip-row"><span class="tip-dot" style="background:${u.color}"></span>${u.username}<span style="margin-left:auto;font-weight:700;padding-left:12px">${u.expanded[idx]}</span></div>`).join("");
    const pct = (xOf(idx) / W) * 100;
    tip.style.left    = pct + "%";
    tip.style.top     = "8px";
    tip.style.display = "block";
}
function chartLeave() {
    document.getElementById("chart-tip").style.display = "none";
    hoveredX = null;
}

fetch(BASE_PATH + "/api/get-score-history.php")
    .then(r => r.ok ? r.json() : Promise.reject("Chart load failed"))
    .then(buildChart)
    .catch(() => {
        document.getElementById("chart-wrap").innerHTML =
            `<p style="color:var(--text-3);text-align:center;padding:40px 0;font-size:13px;">Chart unavailable</p>`;
    });
</script>

<?php require_once __DIR__ . "/includes/footer.php"; ?>
