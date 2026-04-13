<?php
// ── CORS Headers (MUST be first - before any output) ─────────────────────
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── Database Connection ───────────────────────────────────────────────────
$host   = "localhost";
$dbname = "quiz";       
$user   = "root";
$pass   = "";           // XAMPP default: empty password

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    echo json_encode([
        "success" => false,
        "error"   => "DB connection failed: " . $conn->connect_error
    ]);
    exit();
}

$conn->set_charset("utf8mb4");
$conn->query("SET NAMES utf8mb4");

// Large packet size for base64 images
$conn->query("SET SESSION max_allowed_packet = 67108864");
?>
