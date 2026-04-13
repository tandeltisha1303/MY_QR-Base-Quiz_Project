<?php
require 'db.php';

$raw  = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(["success" => false, "error" => "Invalid JSON input."]);
    exit();
}

$quiz_id    = trim($data['id']       ?? '');
$title      = trim($data['title']    ?? '');
$subject    = trim($data['subject']  ?? '');
$sem        = trim($data['sem']      ?? '');
$time_limit = intval($data['time']   ?? 0);
$questions  = $data['questions']     ?? [];
$qr_url     = $data['quizUrl']       ?? null;
$admin_id   = intval($data['admin_id'] ?? 0);   

if (!$quiz_id || !$title || !$subject || !$sem || !$time_limit) {
    echo json_encode([
        "success"  => false,
        "error"    => "Missing required fields.",
        "received" => compact('quiz_id', 'title', 'subject', 'sem', 'time_limit')
    ]);
    exit();
}

$stmt = $conn->prepare(
    "INSERT INTO quizzes (id, title, subject, sem, time_limit, qr_url, admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title      = VALUES(title),
       subject    = VALUES(subject),
       sem        = VALUES(sem),
       time_limit = VALUES(time_limit),
       qr_url     = VALUES(qr_url),
       admin_id   = VALUES(admin_id)"
);

if (!$stmt) {
    echo json_encode(["success" => false, "error" => "Prepare failed: " . $conn->error]);
    exit();
}

$stmt->bind_param("ssssisi", $quiz_id, $title, $subject, $sem, $time_limit, $qr_url, $admin_id);

if (!$stmt->execute()) {
    echo json_encode(["success" => false, "error" => "Quiz insert failed: " . $stmt->error]);
    $stmt->close(); $conn->close(); exit();
}
$stmt->close();

// ── Delete old questions for this quiz ────────────────────────────────────
$conn->query("DELETE FROM questions WHERE quiz_id = '" . $conn->real_escape_string($quiz_id) . "'");

// ── Insert questions ───────────────────────────────────────────────────────
if (empty($questions)) {
    echo json_encode(["success" => true, "quiz_id" => $quiz_id, "questions_saved" => 0, "message" => "Quiz saved (no questions)."]);
    $conn->close(); exit();
}

$q_stmt = $conn->prepare(
    "INSERT INTO questions
       (quiz_id, question_number, type, question_text, question_image,
        option_a, option_b, option_c, option_d,
        option_a_image, option_b_image, option_c_image, option_d_image,
        correct_answer, multi_correct_answers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

if (!$q_stmt) {
    echo json_encode(["success" => false, "error" => "Question prepare failed: " . $conn->error]);
    $conn->close(); exit();
}

$saved  = 0;
$errors = [];

foreach ($questions as $i => $q) {
    $q_num   = $i + 1;
    $type    = $q['type']  ?? 'mcq';
    $q_text  = $q['text']  ?? '';
    $q_img   = $q['image'] ?? null;
    $opt_a   = $q['a']     ?? null;
    $opt_b   = $q['b']     ?? null;
    $opt_c   = $q['c']     ?? null;
    $opt_d   = $q['d']     ?? null;
    $img_a   = $q['aImg']  ?? null;
    $img_b   = $q['bImg']  ?? null;
    $img_c   = $q['cImg']  ?? null;
    $img_d   = $q['dImg']  ?? null;
    $correct = null;
    $multi   = null;

    if ($type === 'multi') {
        $mc    = is_array($q['multiCorrect'] ?? null) ? $q['multiCorrect'] : [];
        $multi = implode(',', $mc);
    } else {
        $correct = $q['correct'] ?? null;
        if ($type === 'tf') {
            $opt_a = $opt_a ?: 'True';
            $opt_b = $opt_b ?: 'False';
        }
    }

    $q_stmt->bind_param(
        "sisssssssssssss",
        $quiz_id, $q_num, $type, $q_text, $q_img,
        $opt_a, $opt_b, $opt_c, $opt_d,
        $img_a, $img_b, $img_c, $img_d,
        $correct, $multi
    );

    if ($q_stmt->execute()) {
        $saved++;
    } else {
        $errors[] = "Q{$q_num}: " . $q_stmt->error;
    }
}

$q_stmt->close();
$conn->close();

echo json_encode([
    "success"         => true,
    "quiz_id"         => $quiz_id,
    "questions_saved" => $saved,
    "errors"          => $errors,
    "message"         => "Quiz saved! $saved questions stored in database."
]);
?>