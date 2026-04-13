<?php
require 'db.php';

$data = json_decode(file_get_contents("php://input"), true);

$quiz_id = intval($data['quiz_id']);
$questions = $data['questions'];

foreach ($questions as $q) {

    $question_text = $conn->real_escape_string($q['question_text']);
    $question_type = $conn->real_escape_string($q['question_type']);

    // Insert Question
    $sql = "INSERT INTO questions (quiz_id, question_text, question_type)
            VALUES ('$quiz_id', '$question_text', '$question_type')";

    if ($conn->query($sql)) {
        $question_id = $conn->insert_id;

        // Insert Options
        foreach ($q['options'] as $opt) {
            $label = $opt['label'];
            $text = $conn->real_escape_string($opt['text']);
            $is_correct = $opt['is_correct'] ? 1 : 0;

            $optSql = "INSERT INTO options (question_id, option_label, option_text, is_correct)
                       VALUES ('$question_id', '$label', '$text', '$is_correct')";

            $conn->query($optSql);
        }
    }
}

echo json_encode([
    "success" => true,
    "message" => "Questions saved successfully"
]);
?>