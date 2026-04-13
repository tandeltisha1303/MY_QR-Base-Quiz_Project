<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

$host = "localhost"; $dbname = "quiz"; $user = "root"; $pass = "";
$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    echo json_encode(["apache" => "OK", "db" => "FAILED", "error" => $conn->connect_error]);
} else {
    $tables = [];
    $res = $conn->query("SHOW TABLES");
    while ($row = $res->fetch_row()) $tables[] = $row[0];
    echo json_encode(["apache" => "OK", "db" => "OK", "tables" => $tables]);
}
?>