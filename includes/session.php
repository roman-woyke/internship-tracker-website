<?php

session_start();

if (!isset($_SESSION["user_id"])) {
    header("Location: /roman/login.php");
    exit;
}