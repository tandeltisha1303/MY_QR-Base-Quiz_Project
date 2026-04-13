<?php
require 'db.php';

$admin_id = intval($_GET['admin_id'] ?? 0);

if (!$admin_id) {
    echo json_encode(["success" => false, "error" => "admin_id required.", "quizzes" => []]);
    $conn->close(); exit();
}

$stmt = $conn->prepare(
    "SELECT q.id, q.title, q.subject, q.sem, q.time_limit, q.qr_url, q.created_at,
            COUNT(qa.id) AS participant_count
     FROM quizzes q
     LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id
     WHERE q.admin_id = ?
     GROUP BY q.id
     ORDER BY q.created_at DESC"
);
$stmt->bind_param("i", $admin_id);
$stmt->execute();
$result = $stmt->get_result();

if (!$result) {
    echo json_encode(["success" => false, "error" => $conn->error, "quizzes" => []]);
    $conn->close(); exit();
}

$quizzes = [];
while ($row = $result->fetch_assoc()) {
    $qr     = $conn->query("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = '" . $conn->real_escape_string($row['id']) . "'");
    $qcount = ($qr) ? (int)$qr->fetch_assoc()['cnt'] : 0;

    $quizzes[] = [
        "id"                => $row['id'],
        "title"             => $row['title'],
        "subject"           => $row['subject'],
        "sem"               => $row['sem'],
        "time"              => (int)$row['time_limit'],
        "qrUrl"             => $row['qr_url'] ?? null,
        "date"              => date('d M Y', strtotime($row['created_at'])),
        "questions"         => $qcount,
        "participant_count" => (int)$row['participant_count'],
        "active"            => true,
    ];
}

$stmt->close();
echo json_encode(["success" => true, "quizzes" => $quizzes]);
$conn->close();
?>