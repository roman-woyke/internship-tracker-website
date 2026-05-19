<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>intern.track</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/style.css">
</head>
<body>

<?php
$currentPage = basename($_SERVER['PHP_SELF']);
$username    = $_SESSION['username'] ?? '';
$initial     = strtoupper(mb_substr($username, 0, 1));
?>

<nav class="navbar">
    <a href="<?= BASE_PATH ?>/dashboard.php" class="brand">
        <div class="brand-mark">i</div>
        <span>intern<span style="color:var(--text-3);font-weight:500">.</span>track</span>
        <span class="brand-dot"></span>
    </a>

    <div class="nav-tabs">
        <a href="<?= BASE_PATH ?>/dashboard.php"
           class="nav-tab <?= $currentPage === 'dashboard.php' ? 'active' : '' ?>">
            Dashboard
        </a>
        <a href="<?= BASE_PATH ?>/leaderboard.php"
           class="nav-tab <?= $currentPage === 'leaderboard.php' ? 'active' : '' ?>">
            Leaderboard
        </a>
    </div>

    <div class="topbar-spacer"></div>

    <?php if ($username): ?>
    <div class="user-chip">
        <div class="avatar"><?= htmlspecialchars($initial) ?></div>
        <span class="name"><?= htmlspecialchars($username) ?></span>
    </div>
    <?php endif; ?>

    <a href="<?= BASE_PATH ?>/logout.php" class="logout-btn" title="Logout">↪</a>
</nav>

<main class="container">
