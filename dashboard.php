<?php

require_once __DIR__ . "/includes/session.php";
require_once __DIR__ . "/includes/scoring.php";

$userId   = $_SESSION["user_id"];
$username = $_SESSION["username"];

// ── 1. Leaderboard: users + stats ─────────────────────────────────────
$users = $pdo->query("
    SELECT
        users.id   AS user_id,
        users.username,
        COUNT(applications.id)                              AS total_applications,
        COALESCE(SUM(applications.status = 'PENDING'),   0) AS pending,
        COALESCE(SUM(applications.status = 'REJECTED'),  0) AS rejected,
        COALESCE(SUM(applications.status = 'GHOSTED'),   0) AS ghosted,
        COALESCE(SUM(applications.status = 'INTERVIEW'), 0) AS interviews,
        COALESCE(SUM(applications.status = 'OFFER'),     0) AS offers
    FROM users
    LEFT JOIN applications ON users.id = applications.user_id
    GROUP BY users.id, users.username
")->fetchAll(PDO::FETCH_ASSOC);

// Compute scores via scoring.php
$scoreByUser = [];
foreach ($pdo->query("
    SELECT h.status, a.tag, a.user_id
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
")->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $scoreByUser[$r["user_id"]] = ($scoreByUser[$r["user_id"]] ?? 0) + scorePoints($r["status"], $r["tag"]);
}

foreach ($users as &$u) { $u["score"] = $scoreByUser[$u["user_id"]] ?? 0; }
unset($u);

usort($users, fn($a, $b) =>
    $b["score"]    <=> $a["score"]    ?:
    $b["offers"]   <=> $a["offers"]   ?:
    $b["interviews"] <=> $a["interviews"]
);

// ── 2. Attach applications with peak status ───────────────────────────
$appsByUser = [];
foreach ($pdo->query("
    SELECT a.user_id, a.id AS application_id,
           a.company_name, a.job_title, a.job_link, a.location,
           a.status, a.notes, a.tag, a.created_at, a.updated_at,
           " . peakStatusSql() . "
    FROM applications a
    LEFT JOIN application_status_history h ON h.application_id = a.id
    GROUP BY a.id, a.user_id, a.company_name, a.job_title, a.job_link,
             a.location, a.status, a.notes, a.tag, a.created_at, a.updated_at
    ORDER BY a.created_at DESC
")->fetchAll(PDO::FETCH_ASSOC) as $app) {
    $appsByUser[$app["user_id"]][] = $app;
}

foreach ($users as &$u) {
    $u["applications"] = $appsByUser[$u["user_id"]] ?? [];
    unset($u["user_id"]);
}
unset($u);

// ── 3. Score history (for chart) ──────────────────────────────────────
$historyByUser = [];
$eventsByUser  = [];
$eventOrder    = 0;

foreach ($pdo->query("
    SELECT h.id, h.user_id, h.application_id, h.status, h.changed_at,
           a.company_name, a.tag
    FROM application_status_history h
    JOIN applications a ON a.id = h.application_id
    ORDER BY h.changed_at ASC, h.id ASC
")->fetchAll(PDO::FETCH_ASSOC) as $ev) {
    $uid      = $ev["user_id"];
    $eventKey = "event-" . $ev["id"];
    $delta    = scorePoints($ev["status"], $ev["tag"] ?? null);

    $historyByUser[$uid]["score"] = ($historyByUser[$uid]["score"] ?? 0) + $delta;
    $historyByUser[$uid]["points"][] = [
        "key"   => $eventKey,
        "order" => $eventOrder,
        "time"  => $ev["changed_at"],
        "score" => $historyByUser[$uid]["score"],
    ];

    $eventsByUser[$uid][$eventKey] = [[
        "status"  => $ev["status"],
        "tag"     => $ev["tag"],
        "company" => $ev["company_name"],
        "delta"   => $delta,
    ]];

    $eventOrder++;
}

$scoreHistory = [];
$scoreEvents  = [];
foreach ($pdo->query("SELECT id, username FROM users ORDER BY id")->fetchAll(PDO::FETCH_ASSOC) as $u) {
    if (!empty($historyByUser[$u["id"]]["points"])) {
        $scoreHistory[] = [
            "username" => $u["username"],
            "points"   => $historyByUser[$u["id"]]["points"],
        ];
    }
    if (!empty($eventsByUser[$u["id"]])) {
        $scoreEvents[$u["username"]] = $eventsByUser[$u["id"]];
    }
}

// ── 4. Current user's weekly activity ────────────────────────────────
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

$dailyActivity = [];
for ($i = 0; $i < 7; $i++) {
    $d = date("Y-m-d", strtotime("$monday +{$i} days"));
    $dailyActivity[] = isset($actByDay[$d]);
}

// ── 5. Bundle for React ───────────────────────────────────────────────
$initData = [
    "view"        => "dashboard",
    "basePath"    => BASE_PATH,
    "currentUser" => [
        "username"      => $username,
        "weeklyApps"    => array_sum($actByDay),
        "dailyActivity" => $dailyActivity,
        "todayDow"      => $todayDow,
    ],
    "leaderboard"  => $users,
    "scoreHistory" => $scoreHistory,
    "scoreEvents"  => $scoreEvents,
];
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>intern.track — Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/styles.css">
    <style>
        /* nav-tab used as <a> link — prevent browser underline */
        a.nav-tab { display: inline-block; text-decoration: none; }
        a.nav-tab:hover { text-decoration: none; }
        a.icon-btn { display: grid; place-items: center; }
    </style>
</head>
<body>
<script>
window.__TWEAK_DEFAULTS__ = { "accent": "#22c55e", "dark": true };
window.__INIT_DATA__ = <?= json_encode($initData, JSON_HEX_TAG | JSON_HEX_AMP) ?>;
</script>

<div id="root"></div>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>

<script type="text/babel" src="<?= BASE_PATH ?>/tweaks-panel.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/icons.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/data.real.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/chart.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/leaderboard.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/sidebar.real.jsx"></script>
<script type="text/babel" src="<?= BASE_PATH ?>/app.real.jsx"></script>
</body>
</html>
