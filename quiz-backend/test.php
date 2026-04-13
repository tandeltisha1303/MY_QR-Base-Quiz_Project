<?php
// ── CORS ──────────────────────────────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=utf-8");

$tests = [];

// Test 1: PHP working
$tests['php'] = "✅ PHP is working — version " . phpversion();

// Test 2: MySQL connection
$conn = @new mysqli("localhost", "root", "", "quiz");
if ($conn->connect_error) {
    $tests['database'] = "❌ DB connection failed: " . $conn->connect_error;
    $tests['fix']      = "Start MySQL in XAMPP Control Panel";
} else {
    $tests['database'] = "✅ Database 'quiz' connected!";
    
    // Test 3: Tables exist
    $tables = [];
    $res = $conn->query("SHOW TABLES");
    while ($row = $res->fetch_row()) $tables[] = $row[0];
    $tests['tables'] = $tables;
    
    $required = ['quizzes','questions','quiz_attempts','student_answers','admins'];
    $missing  = array_diff($required, $tables);
    if ($missing) {
        $tests['missing_tables'] = "❌ Missing: " . implode(', ', $missing) . " — Run STEP1_RUN_THIS_SQL.sql first!";
    } else {
        $tests['tables_status'] = "✅ All required tables exist!";
    }
    
    // Test 4: Admin count
    $r = $conn->query("SELECT COUNT(*) as c FROM admins");
    if ($r) {
        $row = $r->fetch_assoc();
        $tests['admins'] = "✅ Admins in DB: " . $row['c'];
    }
    
    $conn->close();
}

echo json_encode($tests, JSON_PRETTY_PRINT);
?>
