<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require 'db.php';

$quiz_id = isset($_GET['quiz_id']) ? trim($_GET['quiz_id']) : '';

if (!$quiz_id) {
    echo json_encode(["success" => false, "error" => "quiz_id parameter is required."]);
    exit();
}

$stmt = $conn->prepare("SELECT * FROM quizzes WHERE id = ?");
$stmt->bind_param("s", $quiz_id);
$stmt->execute();
$quizResult = $stmt->get_result();

if ($quizResult->num_rows === 0) {
    echo json_encode(["success" => false, "error" => "Quiz #$quiz_id not found in database."]);
    $stmt->close(); $conn->close(); exit();
}

$quiz = $quizResult->fetch_assoc();
$stmt->close();

$qstmt = $conn->prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY question_number ASC");
$qstmt->bind_param("s", $quiz_id);
$qstmt->execute();
$qResult = $qstmt->get_result();

$questions = [];
while ($row = $qResult->fetch_assoc()) {
    $questions[] = [
        'id'           => (int)$row['id'],
        'type'         => $row['type']              ?? 'mcq',
        'text'         => $row['question_text']     ?? '',
        'image'        => $row['question_image']    ?? null,
        'a'            => $row['option_a']          ?? null,
        'b'            => $row['option_b']          ?? null,
        'c'            => $row['option_c']          ?? null,
        'd'            => $row['option_d']          ?? null,
        'aImg'         => $row['option_a_image']    ?? null,
        'bImg'         => $row['option_b_image']    ?? null,
        'cImg'         => $row['option_c_image']    ?? null,
        'dImg'         => $row['option_d_image']    ?? null,
        'correct'      => $row['correct_answer']    ?? null,
        'multiCorrect' => ($row['type'] === 'multi' && !empty($row['multi_correct_answers']))
                            ? explode(',', $row['multi_correct_answers']) : [],
    ];
}
$qstmt->close();
$conn->close();

echo json_encode([
    "success"   => true,
    "id"        => $quiz['id'],
    "title"     => $quiz['title'],
    "subject"   => $quiz['subject'],
    "sem"       => $quiz['sem'],
    "time"      => (int)$quiz['time_limit'],
    "qrUrl"     => $quiz['qr_url'] ?? null,
    "questions" => $questions,
]);
?>