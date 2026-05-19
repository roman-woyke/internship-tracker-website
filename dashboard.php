<?php

require_once __DIR__ . "/includes/session.php";
require_once __DIR__ . "/includes/scoring.php";

$userId   = $_SESSION["user_id"];
$username = $_SESSION["username"];

// ── Handle application creation ───────────────────────────────────────
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $companyName = trim($_POST["company_name"] ?? "");
    $jobTitle    = trim($_POST["job_title"]    ?? "");
    $jobLink     = trim($_POST["job_link"]     ?? "");
    $location    = trim($_POST["location"]     ?? "");
    $notes       = trim($_POST["notes"]        ?? "");
    $tag         = trim($_POST["tag"]          ?? "");

    if ($companyName === "") die("Company name is required.");

    $jobTitle = $jobTitle === "" ? null : $jobTitle;
    $jobLink  = $jobLink  === "" ? null : $jobLink;
    $location = $location === "" ? null : $location;
    $notes    = $notes    === "" ? null : $notes;

    $allowedTags = ["MAYBE", "PROBABLY", "FOR SURE", "ABSOLUTE CINEMA"];
    $tag         = in_array($tag, $allowedTags, true) ? $tag : null;

    $stmt = $pdo->prepare("
        INSERT INTO applications (user_id, company_name, job_title, job_link, location, notes, tag, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    ");
    $stmt->execute([$userId, $companyName, $jobTitle, $jobLink, $location, $notes, $tag]);
    $newId = $pdo->lastInsertId();

    $pdo->prepare("INSERT INTO application_status_history (user_id, application_id, status) VALUES (?, ?, 'PENDING')")
        ->execute([$userId, $newId]);

    header("Location: " . BASE_PATH . "/dashboard.php");
    exit;
}

// ── Fetch this user's applications ───────────────────────────────────
$stmt = $pdo->prepare("
    SELECT a.id, a.company_name, a.job_title, a.job_link, a.location,
           a.status, a.notes, a.tag, a.created_at,
           " . peakStatusSql() . "
    FROM applications a
    LEFT JOIN application_status_history h ON h.application_id = a.id
    WHERE a.user_id = ?
    GROUP BY a.id, a.company_name, a.job_title, a.job_link,
             a.location, a.status, a.notes, a.tag, a.created_at
    ORDER BY a.created_at DESC
");
$stmt->execute([$userId]);
$applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Stat strip data ───────────────────────────────────────────────────
$totalSent = count($applications);
$cntInterview = 0; $cntOffer = 0;
foreach ($applications as $a) {
    if ($a["status"] === "INTERVIEW") $cntInterview++;
    if ($a["status"] === "OFFER")     $cntOffer++;
}

// Score + rank
$allScoreRows = $pdo->query("
    SELECT a.user_id, h.status, a.tag
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
")->fetchAll(PDO::FETCH_ASSOC);

$scoreByUser = [];
foreach ($allScoreRows as $r) {
    $scoreByUser[$r["user_id"]] = ($scoreByUser[$r["user_id"]] ?? 0) + scorePoints($r["status"], $r["tag"]);
}
$myScore = $scoreByUser[$userId] ?? 0;
arsort($scoreByUser);
$myRank = 1;
foreach ($scoreByUser as $uid => $_) {
    if ($uid == $userId) break;
    $myRank++;
}

// ── Weekly goal ───────────────────────────────────────────────────────
$goal      = 10;
$monday    = date("Y-m-d", strtotime("monday this week"));
$todayDate = date("Y-m-d");
$todayDow  = (int) date("N") - 1; // 0=Mon … 6=Sun

$actStmt = $pdo->prepare("
    SELECT DATE(created_at) AS day, COUNT(*) AS cnt
    FROM applications
    WHERE user_id = ? AND DATE(created_at) >= ?
    GROUP BY DATE(created_at)
");
$actStmt->execute([$userId, $monday]);
$actByDay = [];
foreach ($actStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $actByDay[$r["day"]] = (int) $r["cnt"];
}
$thisWeekApps = array_sum($actByDay);

$weekDayLabels = ["M","T","W","T","F","S","S"];
$weekDates = [];
for ($i = 0; $i < 7; $i++) {
    $weekDates[] = date("Y-m-d", strtotime($monday . " +{$i} days"));
}

// Tag badge helper
function tagBadge(?string $tag): string {
    if (empty($tag)) return "";
    $slug = strtolower(str_replace(' ', '-', $tag));
    return '<span class="tag-badge tag-badge-' . $slug . '">' . htmlspecialchars($tag) . '</span>';
}

require_once __DIR__ . "/includes/header.php";
?>

<!-- ══════════════════════════════════════════════════════════
     HERO STAT STRIP
════════════════════════════════════════════════════════════ -->
<div class="stats-row">

    <div class="stat featured">
        <span class="stat-rank">RANK #<?= $myRank ?></span>
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/></svg>
            <?= htmlspecialchars($username) ?>'s score
        </div>
        <div class="stat-value"><?= $myScore ?></div>
        <div class="stat-foot">total points earned</div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            Applications sent
        </div>
        <div class="stat-value"><?= $totalSent ?></div>
        <div class="stat-foot">all time</div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>
            Interviews
        </div>
        <div class="stat-value"><?= $cntInterview ?></div>
        <div class="stat-foot"><?= $totalSent > 0 ? round($cntInterview / $totalSent * 100) . "% conversion" : "no apps yet" ?></div>
    </div>

    <div class="stat">
        <div class="stat-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/></svg>
            Offers
        </div>
        <div class="stat-value"><?= $cntOffer ?></div>
        <div class="stat-foot"><?= $cntOffer > 0 ? "🎉 First offer secured!" : "Still hunting — close!" ?></div>
    </div>

</div>

<!-- ══════════════════════════════════════════════════════════
     MAIN GRID
════════════════════════════════════════════════════════════ -->
<div class="dashboard-grid">

<!-- ── LEFT COLUMN ─────────────────────────────────────────── -->
<div class="col">

    <!-- Score evolution chart -->
    <div class="card chart-card">
        <div class="card-head">
            <div>
                <h3 class="card-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>
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

    <!-- Applications table -->
    <div class="card">
        <div class="card-head">
            <div>
                <h3 class="card-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                    My Applications
                </h3>
                <p class="card-subtitle"><?= $totalSent ?> total · edit status or tag inline</p>
            </div>
        </div>

        <?php if ($totalSent === 0): ?>
            <p style="color:var(--text-3); text-align:center; padding:40px 0; font-size:13px;">
                No applications yet — add your first one →
            </p>
        <?php else: ?>
        <div style="overflow-x:auto;">
        <table class="lb-table">
            <thead>
                <tr>
                    <th>Tag</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Link</th>
                    <th>Notes</th>
                    <th>Added</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($applications as $app): ?>
            <?php $id = (int) $app["id"]; ?>
            <tr id="app-<?= $id ?>">

                <!-- Tag -->
                <td style="min-width:100px;">
                    <select class="tbl-select tag-select" data-id="<?= $id ?>">
                        <option value="">— none —</option>
                        <?php foreach (["MAYBE","PROBABLY","FOR SURE","ABSOLUTE CINEMA"] as $t): ?>
                            <option value="<?= $t ?>" <?= $app["tag"] === $t ? "selected" : "" ?>><?= $t ?></option>
                        <?php endforeach; ?>
                    </select>
                    <?php if (!empty($app["tag"])): ?>
                        <div style="margin-top:4px;"><?= tagBadge($app["tag"]) ?></div>
                    <?php endif; ?>
                    <button class="save-btn tbl-save" data-id="<?= $id ?>" data-field="tag" style="display:none;">Save</button>
                </td>

                <!-- Company -->
                <td style="font-weight:600; white-space:nowrap;"><?= htmlspecialchars($app["company_name"]) ?></td>

                <!-- Job -->
                <td style="color:var(--text-2);"><?= htmlspecialchars($app["job_title"] ?? "—") ?></td>

                <!-- Location -->
                <td style="color:var(--text-3); font-size:12px;"><?= htmlspecialchars($app["location"] ?? "—") ?></td>

                <!-- Status -->
                <td style="min-width:128px;">
                    <?php if (!empty($app["peak_status"]) && $app["peak_status"] !== $app["status"] && in_array($app["peak_status"], ["INTERVIEW","OFFER"])): ?>
                        <div style="font-size:11px; font-weight:700; color:var(--accent-strong); display:flex; flex-direction:column; align-items:center; gap:1px; margin-bottom:5px;">
                            <span><?= htmlspecialchars($app["peak_status"]) ?></span>
                            <span style="opacity:.35; font-size:10px;">↓</span>
                        </div>
                    <?php endif; ?>
                    <select class="tbl-select status-select" data-id="<?= $id ?>">
                        <?php foreach (["PENDING","REJECTED","GHOSTED","INTERVIEW","OFFER"] as $s): ?>
                            <option value="<?= $s ?>" <?= $app["status"] === $s ? "selected" : "" ?>><?= $s ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button class="save-btn tbl-save" data-id="<?= $id ?>" data-field="status" style="display:none;">Save</button>
                </td>

                <!-- Link -->
                <td>
                    <?php if (!empty($app["job_link"])): ?>
                        <a href="<?= htmlspecialchars($app["job_link"]) ?>" target="_blank"
                           class="link-display-<?= $id ?>"
                           style="font-size:12px;">Open ↗</a>
                    <?php else: ?>
                        <span class="link-display-<?= $id ?>" style="color:var(--text-3);">—</span>
                    <?php endif; ?>
                    <div style="margin-top:4px;">
                        <button class="tbl-edit edit-link-btn" data-id="<?= $id ?>"
                                data-current="<?= htmlspecialchars($app['job_link'] ?? '') ?>">✏</button>
                    </div>
                </td>

                <!-- Notes -->
                <td style="max-width:150px;">
                    <span class="notes-display-<?= $id ?>" style="color:var(--text-2); font-size:12px;">
                        <?= htmlspecialchars(mb_strimwidth($app["notes"] ?? "", 0, 40, "…")) ?>
                    </span>
                    <button class="tbl-edit edit-notes-btn" style="margin-left:4px;"
                            data-id="<?= $id ?>" data-current="<?= htmlspecialchars($app['notes'] ?? '') ?>">✏</button>
                </td>

                <!-- Date -->
                <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-3); white-space:nowrap;">
                    <?= date("d M", strtotime($app["created_at"])) ?>
                </td>

                <!-- Delete -->
                <td><button class="tbl-del delete-btn" data-id="<?= $id ?>">Delete</button></td>

            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        </div>

        <div class="points-legend">
            <span class="pl-item">Pending = <b>+2p</b></span>
            <span class="pl-item">Rejected = <b>-1p</b></span>
            <span class="pl-item">Ghosted = <b>-1p</b></span>
            <span class="pl-item">Interview = <b>+5–13p</b></span>
            <span class="pl-item">Offer = <b>+8–28p</b></span>
        </div>
        <?php endif; ?>
    </div>

</div><!-- /.col left -->

<!-- ── RIGHT COLUMN ────────────────────────────────────────── -->
<div class="col">

    <!-- Weekly goal -->
    <?php
    $pct   = min(1, $thisWeekApps / $goal);
    $r     = 32; $circ = 2 * M_PI * $r;
    $dash  = $circ * $pct;
    $streak = $thisWeekApps; // simple: apps this week as "streak" number
    ?>
    <div class="card goal-card">
        <div class="card-head">
            <div>
                <h3 class="card-title">🔥 Weekly goal</h3>
                <p class="card-subtitle"><?= htmlspecialchars($username) ?> · <?= $thisWeekApps ?> applied this week</p>
            </div>
            <span class="live-pill"><?= $thisWeekApps >= $goal ? "✓ Done!" : "On track" ?></span>
        </div>

        <div class="goal-progress">
            <div class="goal-ring-wrap">
                <svg viewBox="0 0 78 78" width="78" height="78">
                    <circle cx="39" cy="39" r="<?= $r ?>" fill="none" stroke="var(--border)" stroke-width="7"/>
                    <circle cx="39" cy="39" r="<?= $r ?>" fill="none"
                            stroke="var(--accent)" stroke-width="7" stroke-linecap="round"
                            stroke-dasharray="<?= round($dash, 2) ?> <?= round($circ, 2) ?>"
                            transform="rotate(-90 39 39)"
                            style="transition: stroke-dasharray 0.6s;"/>
                </svg>
                <div class="center">
                    <small>Applied</small>
                    <?= $thisWeekApps ?>/<?= $goal ?>
                </div>
            </div>
            <div class="goal-text">
                <div class="big">
                    <?php if ($thisWeekApps >= $goal): ?>
                        Goal crushed! 🎉
                    <?php else: ?>
                        <?= $goal - $thisWeekApps ?> to go this week
                    <?php endif; ?>
                </div>
                <div class="sub">Top performers send ~<?= $goal ?>/week. Keep going!</div>
            </div>
        </div>

        <div class="streak-row">
            <?php foreach ($weekDates as $i => $date): ?>
            <?php
            $isDone  = isset($actByDay[$date]);
            $isToday = $date === $todayDate;
            $cls     = "streak-day" . ($isDone ? " done" : "") . ($isToday ? " today" : "");
            ?>
            <div class="<?= $cls ?>" title="<?= $date ?>">
                <?= $weekDayLabels[$i] ?>
                <?php if ($isDone && $isToday): ?>
                    <span class="flame">🔥</span>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Quick-add form -->
    <div class="card">
        <div class="card-head">
            <div>
                <h3 class="card-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    Log an application
                </h3>
                <p class="card-subtitle">Quick-add what you sent today</p>
            </div>
        </div>

        <form class="qa-form" action="<?= BASE_PATH ?>/dashboard.php" method="POST" id="qa-form">
            <div>
                <label class="qa-label">Company *</label>
                <input class="qa-input" type="text" name="company_name" placeholder="e.g. Google" required>
            </div>
            <div>
                <label class="qa-label">Job title</label>
                <input class="qa-input" type="text" name="job_title" placeholder="e.g. Software Engineer Intern">
            </div>
            <div class="qa-row">
                <div>
                    <label class="qa-label">Location</label>
                    <input class="qa-input" type="text" name="location" placeholder="e.g. Berlin">
                </div>
                <div>
                    <label class="qa-label">Tag</label>
                    <select class="qa-select" name="tag">
                        <option value="">— none —</option>
                        <option value="MAYBE">Maybe</option>
                        <option value="PROBABLY">Probably</option>
                        <option value="FOR SURE">For Sure</option>
                        <option value="ABSOLUTE CINEMA">Absolute Cinema</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="qa-label">Job link</label>
                <input class="qa-input" type="url" name="job_link" placeholder="https://…">
            </div>
            <div>
                <label class="qa-label">Status</label>
                <div class="qa-status-grid">
                    <button type="button" class="qa-status active" data-status="PENDING"  onclick="setStatus(this)">Pending<span class="pts">+2p</span></button>
                    <button type="button" class="qa-status"        data-status="INTERVIEW" onclick="setStatus(this)">Interview<span class="pts">+5p</span></button>
                    <button type="button" class="qa-status"        data-status="OFFER"     onclick="setStatus(this)">Offer<span class="pts">+18p</span></button>
                    <button type="button" class="qa-status"        data-status="REJECTED"  onclick="setStatus(this)">Rejected<span class="pts">-1p</span></button>
                </div>
                <input type="hidden" name="status_unused" id="qa-status-val" value="PENDING">
            </div>
            <div>
                <label class="qa-label">Notes</label>
                <textarea class="qa-textarea" name="notes" placeholder="Any notes…"></textarea>
            </div>
            <button class="btn-primary accent" type="submit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Add to tracker
            </button>
        </form>
    </div>

</div><!-- /.col right -->
</div><!-- /.dashboard-grid -->

<!-- ══════════════════════════════════════════════════════════
     EDIT MODAL
════════════════════════════════════════════════════════════ -->
<div id="edit-modal" class="modal-overlay" style="display:none;">
    <div class="modal-box">
        <h3 id="modal-title" class="modal-title"></h3>
        <textarea id="modal-textarea" class="modal-field" style="display:none; resize:vertical; min-height:100px;"></textarea>
        <input    id="modal-input"    class="modal-field" type="url" style="display:none;">
        <div class="modal-footer">
            <button id="modal-cancel" class="btn-ghost">Cancel</button>
            <button id="modal-save"   class="btn-save-modal">Save</button>
        </div>
    </div>
</div>

<script>
const BASE_PATH = "<?= BASE_PATH ?>";

// ── Inline save: show button on change ───────────────────────────────
document.querySelectorAll(".tag-select, .status-select").forEach(sel => {
    sel.addEventListener("change", () => {
        const id    = sel.dataset.id;
        const field = sel.classList.contains("tag-select") ? "tag" : "status";
        const btn   = document.querySelector(`.save-btn[data-id="${id}"][data-field="${field}"]`);
        if (btn) btn.style.display = "inline-block";
    });
});

document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const id    = btn.dataset.id;
        const field = btn.dataset.field;
        const value = field === "tag"
            ? document.querySelector(`.tag-select[data-id="${id}"]`).value
            : document.querySelector(`.status-select[data-id="${id}"]`).value;

        const body = new FormData();
        body.append("application_id", id);
        body.append(field, value);

        fetch(BASE_PATH + "/api/patch-application.php", { method: "POST", body })
            .then(r => { if (!r.ok) throw new Error("Save failed."); btn.style.display = "none"; })
            .catch(err => alert(err.message));
    });
});

// ── Modal ─────────────────────────────────────────────────────────────
const modal       = document.getElementById("edit-modal");
const modalTitle  = document.getElementById("modal-title");
const modalSave   = document.getElementById("modal-save");
const modalCancel = document.getElementById("modal-cancel");
const modalArea   = document.getElementById("modal-textarea");
const modalInput  = document.getElementById("modal-input");
let modalField = null, modalId = null;

function openModal(id, field, title, current) {
    modalId = id; modalField = field;
    modalTitle.textContent = title;
    if (field === "notes") {
        modalArea.style.display = "block"; modalInput.style.display = "none";
        modalArea.value = current;
    } else {
        modalInput.style.display = "block"; modalArea.style.display = "none";
        modalInput.value = current;
    }
    modal.style.display = "flex";
    (field === "notes" ? modalArea : modalInput).focus();
}
function closeModal() { modal.style.display = "none"; modalField = modalId = null; }
modalCancel.addEventListener("click", closeModal);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

modalSave.addEventListener("click", () => {
    const value = modalField === "notes" ? modalArea.value : modalInput.value;
    const body  = new FormData();
    body.append("application_id", modalId);
    body.append(modalField, value);
    fetch(BASE_PATH + "/api/patch-application.php", { method: "POST", body })
        .then(r => {
            if (!r.ok) throw new Error("Save failed.");
            if (modalField === "job_link") {
                const el = document.querySelector(`.link-display-${modalId}`);
                if (value) {
                    const a = document.createElement("a"); a.href = value; a.target = "_blank";
                    a.textContent = "Open ↗"; a.style.fontSize = "12px";
                    a.className = `link-display-${modalId}`; el.replaceWith(a);
                    document.querySelector(`.edit-link-btn[data-id="${modalId}"]`).dataset.current = value;
                } else { el.textContent = "—"; el.removeAttribute("href"); }
            }
            if (modalField === "notes") {
                const s = value.length > 40 ? value.slice(0, 40) + "…" : value;
                document.querySelector(`.notes-display-${modalId}`).textContent = s;
                document.querySelector(`.edit-notes-btn[data-id="${modalId}"]`).dataset.current = value;
            }
            closeModal();
        })
        .catch(err => alert(err.message));
});

document.querySelectorAll(".edit-link-btn").forEach(b =>
    b.addEventListener("click", () => openModal(b.dataset.id, "job_link", "Edit link", b.dataset.current)));
document.querySelectorAll(".edit-notes-btn").forEach(b =>
    b.addEventListener("click", () => openModal(b.dataset.id, "notes", "Edit notes", b.dataset.current)));

document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (!confirm("Delete this application? This cannot be undone.")) return;
        const id = btn.dataset.id, body = new FormData();
        body.append("application_id", id);
        fetch(BASE_PATH + "/api/delete-application.php", { method: "POST", body })
            .then(r => { if (!r.ok) throw new Error("Delete failed."); document.getElementById(`app-${id}`).remove(); })
            .catch(err => alert(err.message));
    });
});

// ── Quick-add status buttons ──────────────────────────────────────────
function setStatus(btn) {
    document.querySelectorAll(".qa-status").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
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

    // Collect all date+score points to determine x and y ranges
    const allDates = new Set();
    data.forEach(u => u.points.forEach(p => allDates.add(p.date)));
    const sortedDates = [...allDates].sort();
    const maxScore    = Math.max(...data.flatMap(u => u.points.map(p => p.score)), 1);
    const yMax        = Math.ceil(maxScore / 20) * 20 || 20;

    const xOf = i  => padL + (i / Math.max(1, sortedDates.length - 1)) * (W - padL - padR);
    const yOf = v  => padT + (1 - v / yMax) * (H - padT - padB);
    const dateIdx = {};
    sortedDates.forEach((d, i) => dateIdx[d] = i);

    let svgHtml = "";

    // y grid
    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        const tv = Math.round(yMax * t);
        const y  = yOf(tv);
        svgHtml += `<line x1="${padL}" x2="${W-padR}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-dasharray="${t===0?'':'3,4'}"/>`;
        svgHtml += `<text x="${padL-8}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${tv}</text>`;
    });

    // x labels (every other date label)
    const labelEvery = sortedDates.length > 10 ? Math.ceil(sortedDates.length / 8) : 1;
    sortedDates.forEach((d, i) => {
        if (i % labelEvery !== 0) return;
        const label = d.slice(5); // MM-DD
        svgHtml += `<text x="${xOf(i)}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-family="var(--font-mono)">${label}</text>`;
    });

    // Build per-user path data
    const userPaths = data.map((u, ci) => {
        const isMe = u.username === ME;
        const color = isMe ? "var(--accent)" : USER_COLORS[ci % USER_COLORS.length];

        // Expand to all dates with forward-fill
        let lastScore = 0;
        const expanded = sortedDates.map(d => {
            const pt = u.points.find(p => p.date === d);
            if (pt) lastScore = pt.score;
            return lastScore;
        });

        const d = expanded.map((v, i) => `${i===0?"M":"L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");

        // Area fill for current user
        let areaPath = "";
        if (isMe) {
            const top  = expanded.map((v, i) => `${i===0?"M":"L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
            const last = expanded.length - 1;
            areaPath = `${top} L${xOf(last).toFixed(2)},${yOf(0)} L${xOf(0).toFixed(2)},${yOf(0)} Z`;
        }

        return { username: u.username, color, isMe, d, areaPath, expanded };
    });

    // Sort so "me" is drawn last (on top)
    userPaths.sort((a, b) => a.isMe ? 1 : b.isMe ? -1 : 0);

    // Gradient def for area fill
    svgHtml += `<defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>`;

    userPaths.forEach(u => {
        if (u.isMe && u.areaPath) {
            svgHtml += `<path d="${u.areaPath}" fill="url(#areaG)"/>`;
        }
        svgHtml += `<path d="${u.d}" fill="none" stroke="${u.color}"
            stroke-width="${u.isMe ? 3 : 1.7}" stroke-linecap="round" stroke-linejoin="round"
            opacity="${u.isMe ? 1 : 0.55}"/>`;
    });

    // Dots on current user line
    const meUser = userPaths.find(u => u.isMe);
    if (meUser) {
        meUser.expanded.forEach((v, i) => {
            svgHtml += `<circle cx="${xOf(i).toFixed(2)}" cy="${yOf(v).toFixed(2)}" r="3"
                fill="var(--surface)" stroke="var(--accent)" stroke-width="2" data-idx="${i}"/>`;
        });
    }

    // Hover overlay (invisible wide rect)
    svgHtml += `<rect id="chart-hover-zone" x="${padL}" y="${padT}" width="${W-padL-padR}" height="${H-padT-padB}" fill="transparent"/>`;

    svg.innerHTML = svgHtml;

    // Store metadata on svg for mousemove
    svg._meta = { xOf, yOf, sortedDates, userPaths, padL, padR, W };

    // Legend
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

    // Tooltip
    const tip   = document.getElementById("chart-tip");
    const date  = sortedDates[idx];
    const rows  = [...userPaths].sort((a, b) => b.expanded[idx] - a.expanded[idx]).slice(0, 5);
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

// Fetch and render
fetch(BASE_PATH + "/api/get-score-history.php")
    .then(r => r.ok ? r.json() : Promise.reject("Chart load failed"))
    .then(buildChart)
    .catch(() => {
        document.getElementById("chart-wrap").innerHTML =
            `<p style="color:var(--text-3);text-align:center;padding:40px 0;font-size:13px;">Chart unavailable</p>`;
    });
</script>

<?php require_once __DIR__ . "/includes/footer.php"; ?>
