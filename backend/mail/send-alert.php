<?php
// TNT Pulse — internal alert mailer
// Sends a one-way alert email via PHP's mail() to company employees only.
// Accepts POST with: to, subject, message (message is HTML).

header('Content-Type: application/json');

// Internal only — reject anything not coming from this server.
$remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remoteAddr, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$to = trim($_POST['to'] ?? '');
$subject = trim($_POST['subject'] ?? '');
$message = (string)($_POST['message'] ?? '');

if ($to === '' || $subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'to, subject, and message are required']);
    exit;
}

// Validate recipient email(s).
$emails = array_filter(array_map('trim', explode(',', $to)));
$valid = array_filter($emails, function ($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL);
});
if (count($valid) === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No valid recipient email']);
    exit;
}
$to = implode(', ', $valid);

$from = getenv('MAIL_FROM') ?: 'noreply@pulse.tntinnov.com';
$fromName = getenv('MAIL_FROM_NAME') ?: 'TNT Pulse';

$from = str_replace(["\r", "\n"], '', $from);
$fromName = str_replace(["\r", "\n"], '', $fromName);

$headers = [
    'From: ' . $fromName . ' <' . $from . '>',
    'Reply-To: ' . $from,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
];

$sent = mail($to, $subject, $message, implode("\r\n", $headers));

if ($sent) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'mail() returned false']);
}
