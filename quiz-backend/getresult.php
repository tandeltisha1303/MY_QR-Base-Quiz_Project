<?php
require 'db.php';

$quiz_id = isset($_GET['quiz_id']) ? $conn->real_escape_string(trim($_GET['quiz_id'])) : '';

if (!$quiz_id) {
    echo json_encode(["success" => false, "error" => "quiz_id required."]);
    exit();
}

$stmt = $conn->prepare(
    "SELECT qa.*, q.title AS quiz_title
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.quiz_id = ?
     ORDER BY qa.score DESC, qa.submitted_at ASC"
);
$stmt->bind_param("s", $quiz_id);
$stmt->execute();
$result = $stmt->get_result();

$results = [];
while ($row = $result->fetch_assoc()) {
    $results[] = [
        "id"     => (int)$row['id'],
        "name"   => $row['student_name'],
        "email"  => $row['student_email'] ?? '',
        "sem"    => $row['student_sem']   ?? '',
        "div"    => $row['student_div']   ?? '',
        "quiz"   => $row['quiz_title'],
        "quizId" => $row['quiz_id'],
        "score"  => (int)$row['score'],
        "total"  => (int)$row['total_questions'],
        "date"   => $row['submitted_at'] ? date('Y-m-d', strtotime($row['submitted_at'])) : '',
    ];
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "results" => $results]);
?>
