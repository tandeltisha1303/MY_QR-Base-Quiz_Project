<?php
require 'db.php';

$data    = json_decode(file_get_contents("php://input"), true);
$quiz_id = $conn->real_escape_string(trim($data['quiz_id'] ?? ''));

if (!$quiz_id) {
    echo json_encode(["success" => false, "error" => "quiz_id required."]);
    exit();
}

$stmt = $conn->prepare("DELETE FROM quizzes WHERE id = ?");
$stmt->bind_param("s", $quiz_id);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Quiz deleted successfully."]);
} else {
    echo json_encode(["success" => false, "error" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>
