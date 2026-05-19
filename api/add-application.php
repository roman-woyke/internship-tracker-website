<?php

require_once __DIR__ . "/../includes/start-session.php";
require_once __DIR__ . "/../includes/scoring.php";
require_once __DIR__ . "/../../config.php";

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    exit("Not logged in.");
}
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit("Method not allowed.");
}

$userId      = (int) $_SESSION["user_id"];
$companyName = trim($_POST["company_name"] ?? "");
$jobTitle    = trim($_POST["job_title"]    ?? "");
$status      = trim($_POST["status"]       ?? "PENDING");
$jobLink     = trim($_POST["job_link"]     ?? "");
$location    = trim($_POST["location"]     ?? "");
$notes       = trim($_POST["notes"]        ?? "");
$tag         = trim($_POST["tag"]          ?? "");

if ($companyName === "") {
    http_response_code(422);
    exit("Company name required.");
}

$allowedStatuses = ["PENDING", "REJECTED", "GHOSTED", "INTERVIEW", "OFFER"];
if (!in_array($status, $allowedStatuses, true)) $status = "PENDING";

$allowedTags = ["", "MAYBE", "PROBABLY", "FOR SURE", "ABSOLUTE CINEMA"];
if (!in_array($tag, $allowedTags, true)) $tag = "";

$jobTitle = $jobTitle !== "" ? $jobTitle : null;
$jobLink  = $jobLink  !== "" ? $jobLink  : null;
$location = $location !== "" ? $location : null;
$notes    = $notes    !== "" ? $notes    : null;
$tag      = $tag      !== "" ? $tag      : null;

$stmt = $pdo->prepare("
    INSERT INTO applications (user_id, company_name, job_title, job_link, location, status, notes, tag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->execute([$userId, $companyName, $jobTitle, $jobLink, $location, $status, $notes, $tag]);
$newId = $pdo->lastInsertId();

$pdo->prepare("
    INSERT INTO application_status_history (user_id, application_id, status)
    VALUES (?, ?, ?)
")->execute([$userId, $newId, $status]);

header("Content-Type: application/json");
echo json_encode(["id" => $newId, "ok" => true]);
