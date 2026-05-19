<?php

require_once __DIR__ . "/includes/session.php";
require_once __DIR__ . "/includes/scoring.php";

$userId = $_SESSION["user_id"];

// ── Handle application creation ───────────────────────────────────────
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $companyName = trim($_POST["company_name"] ?? "");
    $jobTitle    = trim($_POST["job_title"]    ?? "");
    $jobLink     = trim($_POST["job_link"]     ?? "");
    $location    = trim($_POST["location"]     ?? "");
    $notes       = trim($_POST["notes"]        ?? "");
    $tag         = trim($_POST["tag"]          ?? "");

    if ($companyName === "") {
        die("Company name is required.");
    }

    $jobTitle = $jobTitle === "" ? null : $jobTitle;
    $jobLink  = $jobLink  === "" ? null : $jobLink;
    $location = $location === "" ? null : $location;
    $notes    = $notes    === "" ? null : $notes;

    $allowedTags = ["MAYBE", "PROBABLY", "FOR SURE", "ABSOLUTE CINEMA"];
    $tag         = in_array($tag, $allowedTags, true) ? $tag : null;

    $stmt = $pdo->prepare("
        INSERT INTO applications (
            user_id, company_name, job_title, job_link, location, notes, tag, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    ");
    $stmt->execute([$userId, $companyName, $jobTitle, $jobLink, $location, $notes, $tag]);
    $newApplicationId = $pdo->lastInsertId();

    $historyStmt = $pdo->prepare("
        INSERT INTO application_status_history (user_id, application_id, status)
        VALUES (?, ?, 'PENDING')
    ");
    $historyStmt->execute([$userId, $newApplicationId]);

    header("Location: " . BASE_PATH . "/dashboard.php");
    exit;
}

// ── Fetch applications ────────────────────────────────────────────────
$stmt = $pdo->prepare("
    SELECT
        a.id,
        a.company_name,
        a.job_title,
        a.job_link,
        a.location,
        a.status,
        a.notes,
        a.tag,
        a.created_at,

        " . peakStatusSql() . "

    FROM applications a
    LEFT JOIN application_status_history h
        ON h.application_id = a.id

    WHERE a.user_id = ?

    GROUP BY
        a.id, a.company_name, a.job_title, a.job_link,
        a.location, a.status, a.notes, a.tag, a.created_at

    ORDER BY a.created_at DESC
");
$stmt->execute([$userId]);
$applications = $stmt->fetchAll(PDO::FETCH_ASSOC);

// ── Compute stats for the hero strip ─────────────────────────────────
$totalSent       = count($applications);
$countInterviews = 0;
$countOffers     = 0;
foreach ($applications as $a) {
    if ($a["status"] === "INTERVIEW") $countInterviews++;
    if ($a["status"] === "OFFER")     $countOffers++;
}

$scoreStmt = $pdo->prepare("
    SELECT h.status, a.tag
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
    WHERE a.user_id = ?
");
$scoreStmt->execute([$userId]);
$myScore = 0;
foreach ($scoreStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $myScore += scorePoints($row["status"], $row["tag"]);
}

function tagBadge(?string $tag): string {
    if (empty($tag)) return "";
    $slug  = strtolower(str_replace(' ', '-', $tag));
    $label = htmlspecialchars($tag);
    return '<span class="tag-badge tag-badge-' . $slug . '">' . $label . '</span>';
}

require_once __DIR__ . "/includes/header.php";
?>

<!-- ── Hero stat strip ──────────────────────────────────────────────── -->
<div class="stats-row">
    <div class="stat featured">
        <span class="stat-rank">#<?= $totalSent > 0 ? "—" : "—" ?></span>
        <div class="stat-label">🏆 Your score</div>
        <div class="stat-value"><?= $myScore ?></div>
        <div class="stat-foot">total points earned</div>
    </div>
    <div class="stat">
        <div class="stat-label">📋 Sent</div>
        <div class="stat-value"><?= $totalSent ?></div>
        <div class="stat-foot">applications total</div>
    </div>
    <div class="stat">
        <div class="stat-label">✨ Interviews</div>
        <div class="stat-value"><?= $countInterviews ?></div>
        <div class="stat-foot"><?= $totalSent > 0 ? round($countInterviews / $totalSent * 100) . "% conversion" : "no apps yet" ?></div>
    </div>
    <div class="stat">
        <div class="stat-label">🎯 Offers</div>
        <div class="stat-value"><?= $countOffers ?></div>
        <div class="stat-foot"><?= $countOffers > 0 ? "🎉 keep it up!" : "still hunting!" ?></div>
    </div>
</div>

<!-- ── Main grid ────────────────────────────────────────────────────── -->
<div class="dashboard-grid">

    <!-- Left: applications table -->
    <div class="col">
        <div class="card">
            <div class="card-head">
                <div>
                    <h2 class="card-title">My Applications</h2>
                    <p class="card-subtitle"><?= $totalSent ?> total · click a status or tag to edit inline</p>
                </div>
            </div>

            <?php if (count($applications) === 0): ?>
                <p style="color:var(--text-3); text-align:center; padding:32px 0;">
                    No applications yet — add your first one →
                </p>
            <?php else: ?>
            <div style="overflow-x:auto;">
                <table class="lb-table">
                    <thead>
                        <tr>
                            <th>Tag</th>
                            <th>Company</th>
                            <th>Job</th>
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
                            <td style="min-width:110px;">
                                <select class="inline-select tag-select" data-id="<?= $id ?>">
                                    <option value="">— none —</option>
                                    <?php foreach (["MAYBE", "PROBABLY", "FOR SURE", "ABSOLUTE CINEMA"] as $t): ?>
                                        <option value="<?= $t ?>" <?= $app["tag"] === $t ? "selected" : "" ?>><?= $t ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <?php if (!empty($app["tag"])): ?>
                                    <div style="margin-top:5px;"><?= tagBadge($app["tag"]) ?></div>
                                <?php endif; ?>
                                <button class="save-btn save-btn-sm" data-id="<?= $id ?>" data-field="tag" style="display:none;">Save</button>
                            </td>

                            <!-- Company -->
                            <td style="font-weight:600;"><?= htmlspecialchars($app["company_name"]) ?></td>

                            <!-- Job -->
                            <td style="color:var(--text-2);"><?= htmlspecialchars($app["job_title"] ?? "") ?></td>

                            <!-- Location -->
                            <td style="color:var(--text-3); font-size:12px;"><?= htmlspecialchars($app["location"] ?? "") ?></td>

                            <!-- Status -->
                            <td style="min-width:130px;">
                                <?php if (!empty($app["peak_status"]) && $app["peak_status"] !== $app["status"] && in_array($app["peak_status"], ["INTERVIEW", "OFFER"])): ?>
                                    <div class="peak-indicator">
                                        <span><?= htmlspecialchars($app["peak_status"]) ?></span>
                                        <span class="peak-arrow">↓</span>
                                    </div>
                                <?php endif; ?>
                                <select class="inline-select status-select" data-id="<?= $id ?>">
                                    <?php foreach (["PENDING", "REJECTED", "GHOSTED", "INTERVIEW", "OFFER"] as $s): ?>
                                        <option value="<?= $s ?>" <?= $app["status"] === $s ? "selected" : "" ?>><?= $s ?></option>
                                    <?php endforeach; ?>
                                </select>
                                <button class="save-btn save-btn-sm" data-id="<?= $id ?>" data-field="status" style="display:none;">Save</button>
                            </td>

                            <!-- Link -->
                            <td>
                                <?php if (!empty($app["job_link"])): ?>
                                    <a href="<?= htmlspecialchars($app["job_link"]) ?>" target="_blank"
                                       class="link-display-<?= $id ?>"
                                       style="color:var(--accent-strong); font-size:12px;">Open ↗</a>
                                <?php else: ?>
                                    <span class="link-display-<?= $id ?>" style="color:var(--text-3);">—</span>
                                <?php endif; ?>
                                <div style="margin-top:4px;">
                                    <button class="edit-icon-btn edit-link-btn"
                                            data-id="<?= $id ?>"
                                            data-current="<?= htmlspecialchars($app['job_link'] ?? '') ?>">✏</button>
                                </div>
                            </td>

                            <!-- Notes -->
                            <td style="max-width:160px;">
                                <span class="notes-display-<?= $id ?>" style="color:var(--text-2); font-size:12px;">
                                    <?= htmlspecialchars(mb_strimwidth($app["notes"] ?? "", 0, 40, "…")) ?>
                                </span>
                                <button class="edit-icon-btn edit-notes-btn"
                                        data-id="<?= $id ?>"
                                        data-current="<?= htmlspecialchars($app['notes'] ?? '') ?>"
                                        style="margin-left:4px;">✏</button>
                            </td>

                            <!-- Created -->
                            <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-3); white-space:nowrap;">
                                <?= date("d M", strtotime($app["created_at"])) ?>
                            </td>

                            <!-- Delete -->
                            <td>
                                <button class="danger-btn delete-btn" data-id="<?= $id ?>">Delete</button>
                            </td>

                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Right: add form -->
    <div class="col">
        <div class="card">
            <div class="card-head">
                <div>
                    <h2 class="card-title">Log an application</h2>
                    <p class="card-subtitle">Quick-add what you sent today</p>
                </div>
            </div>

            <form class="qa-form" action="<?= BASE_PATH ?>/dashboard.php" method="POST">
                <div>
                    <label class="qa-label">Company *</label>
                    <input class="qa-input" type="text" name="company_name" placeholder="e.g. Google" required>
                </div>
                <div>
                    <label class="qa-label">Job title</label>
                    <input class="qa-input" type="text" name="job_title" placeholder="e.g. SWE Intern">
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
                    <label class="qa-label">Notes</label>
                    <textarea class="qa-textarea" name="notes" placeholder="Any notes…"></textarea>
                </div>
                <button class="btn-primary" type="submit">+ Add application</button>
            </form>
        </div>
    </div>

</div><!-- /.dashboard-grid -->

<!-- ── Edit modal ───────────────────────────────────────────────────── -->
<div id="edit-modal" class="modal-overlay" style="display:none;">
    <div class="modal-box">
        <h3 id="modal-title" class="modal-title"></h3>
        <textarea id="modal-textarea" class="modal-field modal-textarea" style="display:none;"></textarea>
        <input    id="modal-input"    class="modal-field" type="url"     style="display:none;">
        <div class="modal-footer">
            <button id="modal-cancel" class="btn-ghost">Cancel</button>
            <button id="modal-save"   class="btn-save">Save</button>
        </div>
    </div>
</div>

<script>
const BASE_PATH = "<?= BASE_PATH ?>";

// ── Show save button when tag or status changes ───────────────────────

document.querySelectorAll(".tag-select, .status-select").forEach(select => {
    select.addEventListener("change", () => {
        const id    = select.dataset.id;
        const field = select.classList.contains("tag-select") ? "tag" : "status";
        const btn   = document.querySelector(`.save-btn[data-id="${id}"][data-field="${field}"]`);
        if (btn) btn.style.display = "inline-block";
    });
});

// ── Save handler for tag / status ─────────────────────────────────────

document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const id    = btn.dataset.id;
        const field = btn.dataset.field;

        let value;
        if (field === "tag") {
            value = document.querySelector(`.tag-select[data-id="${id}"]`).value;
        } else if (field === "status") {
            value = document.querySelector(`.status-select[data-id="${id}"]`).value;
        }

        const body = new FormData();
        body.append("application_id", id);
        body.append(field, value);

        fetch(BASE_PATH + "/api/patch-application.php", { method: "POST", body })
            .then(r => {
                if (!r.ok) throw new Error("Save failed.");
                btn.style.display = "none";
            })
            .catch(err => alert(err.message));
    });
});

// ── Modal logic ───────────────────────────────────────────────────────

const modal       = document.getElementById("edit-modal");
const modalTitle  = document.getElementById("modal-title");
const modalSave   = document.getElementById("modal-save");
const modalCancel = document.getElementById("modal-cancel");
const modalArea   = document.getElementById("modal-textarea");
const modalInput  = document.getElementById("modal-input");

let modalField = null;
let modalId    = null;

function openModal(id, field, title, currentValue) {
    modalId    = id;
    modalField = field;
    modalTitle.textContent = title;

    if (field === "notes") {
        modalArea.style.display  = "block";
        modalInput.style.display = "none";
        modalArea.value = currentValue;
    } else {
        modalInput.style.display = "block";
        modalArea.style.display  = "none";
        modalInput.value = currentValue;
    }

    modal.style.display = "flex";
    (field === "notes" ? modalArea : modalInput).focus();
}

function closeModal() {
    modal.style.display = "none";
    modalField = null;
    modalId    = null;
}

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
                const displayEl = document.querySelector(`.link-display-${modalId}`);
                if (value) {
                    const a = document.createElement("a");
                    a.href        = value;
                    a.target      = "_blank";
                    a.textContent = "Open ↗";
                    a.style.color = "var(--accent-strong)";
                    a.style.fontSize = "12px";
                    a.className   = `link-display-${modalId}`;
                    displayEl.replaceWith(a);
                    document.querySelector(`.edit-link-btn[data-id="${modalId}"]`).dataset.current = value;
                } else {
                    displayEl.textContent = "—";
                    displayEl.removeAttribute("href");
                }
            }

            if (modalField === "notes") {
                const shortened = value.length > 40 ? value.slice(0, 40) + "…" : value;
                document.querySelector(`.notes-display-${modalId}`).textContent = shortened;
                document.querySelector(`.edit-notes-btn[data-id="${modalId}"]`).dataset.current = value;
            }

            closeModal();
        })
        .catch(err => alert(err.message));
});

// ── Open modal for link ───────────────────────────────────────────────

document.querySelectorAll(".edit-link-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        openModal(btn.dataset.id, "job_link", "Edit link", btn.dataset.current);
    });
});

// ── Open modal for notes ──────────────────────────────────────────────

document.querySelectorAll(".edit-notes-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        openModal(btn.dataset.id, "notes", "Edit notes", btn.dataset.current);
    });
});

// ── Delete handler ────────────────────────────────────────────────────

document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (!confirm("Delete this application? This cannot be undone.")) return;

        const id   = btn.dataset.id;
        const body = new FormData();
        body.append("application_id", id);

        fetch(BASE_PATH + "/api/delete-application.php", { method: "POST", body })
            .then(r => {
                if (!r.ok) throw new Error("Delete failed.");
                document.getElementById(`app-${id}`).remove();
            })
            .catch(err => alert(err.message));
    });
});
</script>

<?php require_once __DIR__ . "/includes/footer.php"; ?>
