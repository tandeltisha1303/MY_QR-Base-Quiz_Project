<?php
require 'db.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    echo json_encode(["success" => false, "error" => "Invalid JSON input."]);
    exit();
}

$quiz_id = $conn->real_escape_string(trim($data['quiz_id'] ?? ''));
$name    = $conn->real_escape_string(trim($data['name']    ?? ''));
$email   = $conn->real_escape_string(trim($data['email']   ?? ''));
$sem     = $conn->real_escape_string(trim($data['sem']     ?? ''));
$div     = $conn->real_escape_string(trim($data['div']     ?? ''));
$score   = intval($data['score'] ?? 0);
$total   = intval($data['total'] ?? 0);
$answers = $data['answers'] ?? [];

if (!$quiz_id || !$name) {
    echo json_encode(["success" => false, "error" => "quiz_id and name are required."]);
    exit();
}

// ── Insert attempt ─────────────────────────────────────────────────────────
$stmt = $conn->prepare(
    "INSERT INTO quiz_attempts
       (quiz_id, student_name, student_email, student_sem, student_div, score, total_questions, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())"
);
$stmt->bind_param("sssssii", $quiz_id, $name, $email, $sem, $div, $score, $total);

if (!$stmt->execute()) {
    echo json_encode(["success" => false, "error" => "Submit failed: " . $stmt->error]);
    $stmt->close(); $conn->close(); exit();
}

$attempt_id = $stmt->insert_id;
$stmt->close();

// ── Insert individual answers ──────────────────────────────────────────────
if (!empty($answers)) {
    $ans_stmt = $conn->prepare(
        "INSERT INTO student_answers (attempt_id, question_id, student_answer, is_correct)
         VALUES (?, ?, ?, ?)"
    );
    foreach ($answers as $ans) {
        $q_id    = intval($ans['question_id'] ?? 0);
        $s_ans   = $conn->real_escape_string($ans['answer'] ?? '');
        $is_corr = ($ans['is_correct'] ?? false) ? 1 : 0;
        $ans_stmt->bind_param("issi", $attempt_id, $q_id, $s_ans, $is_corr);
        $ans_stmt->execute();
    }
    $ans_stmt->close();
}

echo json_encode([
    "success"    => true,
    "attempt_id" => $attempt_id,
    "score"      => $score,
    "total"      => $total,
    "message"    => "Result saved successfully!"
]);

$conn->close();
?>
