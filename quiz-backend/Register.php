<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require_once "db.php";

$data     = json_decode(file_get_contents("php://input"), true);
$name     = trim($data["name"]     ?? "");
$username = trim($data["username"] ?? "");
$password = trim($data["password"] ?? "");

if (!$name || !$username || !$password) {
    echo json_encode(["success" => false, "message" => "All fields are required."]);
    exit;
}
if (strlen($password) < 6) {
    echo json_encode(["success" => false, "message" => "Password must be at least 6 characters."]);
    exit;
}

// ── Check username not already taken ─────────────────────
$stmt = $conn->prepare("SELECT admin_id FROM admins WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    echo json_encode(["success" => false, "message" => "Username already taken. Choose another."]);
    $stmt->close(); $conn->close(); exit;
}
$stmt->close();

// ── Insert new admin ──────────────────────────────────────
$hashed = password_hash($password, PASSWORD_BCRYPT);
$stmt   = $conn->prepare("INSERT INTO admins (name, username, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $username, $hashed);

if ($stmt->execute()) {
    $new_admin_id = $conn->insert_id;
    echo json_encode([
        "success"  => true,
        "message"  => "Account created successfully.",
        "admin_id" => $new_admin_id
    ]);
} else {
    echo json_encode(["success" => false, "message" => "Registration failed: " . $conn->error]);
}

$stmt->close(); $conn->close();
?>
