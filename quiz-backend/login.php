<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require_once "db.php";

$data     = json_decode(file_get_contents("php://input"), true);
$username = trim($data["username"] ?? "");
$password = trim($data["password"] ?? "");

if (!$username || !$password) {
    echo json_encode(["success" => false, "message" => "All fields are required."]);
    exit;
}

$stmt = $conn->prepare("SELECT admin_id, name, username, password FROM admins WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();

$admin_id = null;
$name     = null;
$uname    = null;
$hashed   = null;

$stmt->bind_result($admin_id, $name, $uname, $hashed);
$stmt->fetch();
$stmt->close();

if (!$admin_id || !password_verify($password, $hashed)) {
    echo json_encode(["success" => false, "message" => "Invalid username or password."]);
    $conn->close(); exit;
}

$token = bin2hex(random_bytes(32));

echo json_encode([
    "success" => true,
    "token"   => $token,
    "admin"   => [
        "id"       => $admin_id,
        "name"     => $name,
        "username" => $uname,
    ]
]);

$conn->close();
?>