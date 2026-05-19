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

if ($companyName === "") {
    http_response_code(422);
    exit("Company name required.");
}

$allowed = ["PENDING", "REJECTED", "GHOSTED", "INTERVIEW", "OFFER"];
if (!in_array($status, $allowed, true)) $status = "PENDING";

$jobTitle = $jobTitle !== "" ? $jobTitle : null;

$stmt = $pdo->prepare("
    INSERT INTO applications (user_id, company_name, job_title, status)
    VALUES (?, ?, ?, ?)
");
$stmt->execute([$userId, $companyName, $jobTitle, $status]);
$newId = $pdo->lastInsertId();

$pdo->prepare("
    INSERT INTO application_status_history (user_id, application_id, status)
    VALUES (?, ?, ?)
")->execute([$userId, $newId, $status]);

header("Content-Type: application/json");
echo json_encode(["id" => $newId, "ok" => true]);
