<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($statusCode, $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function password_meets_policy($password)
{
    return is_string($password) && preg_match('/^(?=.*[A-Za-z])(?=.*[^A-Za-z0-9]).{8,}$/', $password);
}

$rawInput = (string) file_get_contents('php://input');
$body = json_decode($rawInput, true);
if (!is_array($body)) {
    respond(400, ['error' => 'Invalid request body.']);
}

$action = strtolower(trim((string)($body['action'] ?? '')));
$host = getenv('DB_HOST');
$host = ($host === false || $host === '') ? '127.0.0.1' : $host;

$port = getenv('DB_PORT');
$port = ($port === false || $port === '') ? '3306' : $port;

$database = getenv('DB_NAME');
$database = ($database === false || $database === '') ? 'itc_database_admin' : $database;

$username = getenv('DB_USER');
$username = ($username === false || $username === '') ? 'root' : $username;

$passwordEnv = getenv('DB_PASSWORD');
$password = ($passwordEnv === false) ? 'root' : $passwordEnv;

if ($action !== 'login' && $action !== 'signup') {
    respond(400, ['error' => 'Invalid action.']);
}

try {
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database),
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    if ($action === 'signup') {
        $name = trim((string)($body['name'] ?? ''));
        $newUsername = trim((string)($body['username'] ?? ''));
        $email = trim((string)($body['email'] ?? ''));
        $newPassword = (string)($body['password'] ?? '');
        $confirmPassword = (string)($body['confirmPassword'] ?? '');

        if ($name === '' || $newUsername === '' || $email === '' || $newPassword === '') {
            respond(400, ['error' => 'Missing required signup fields.']);
        }

        if ($newPassword !== $confirmPassword) {
            respond(400, ['error' => 'Passwords do not match.']);
        }

        if (!password_meets_policy($newPassword)) {
            respond(400, ['error' => 'Password must be at least 8 characters and include letters plus 1 symbol.']);
        }

        $check = $pdo->prepare('SELECT id FROM customers WHERE email = ? OR username = ? LIMIT 1');
        if ($check === false) {
            respond(500, ['error' => 'Database error.']);
        }
        $check->execute([$email, $newUsername]);
        if ($check->fetch()) {
            respond(409, ['error' => 'Email or username already exists.']);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $insert = $pdo->prepare('INSERT INTO customers (email, username, password_hash, name) VALUES (?, ?, ?, ?)');
        $insert->execute([$email, $newUsername, $passwordHash, $name]);

        $userId = (int)$pdo->lastInsertId();
        respond(201, [
            'message' => 'Account created successfully.',
            'user' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'username' => $newUsername,
            ],
        ]);
    }

    $identifier = trim((string)($body['identifier'] ?? $body['email'] ?? ''));
    $loginPassword = (string)($body['password'] ?? '');

    if ($identifier === '' || $loginPassword === '') {
        respond(400, ['error' => 'Email/username and password are required.']);
    }

    $query = $pdo->prepare('SELECT id, name, email, username, password_hash FROM customers WHERE email = ? OR username = ? LIMIT 1');
    if ($query === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $query->execute([$identifier, $identifier]);
    $customer = $query->fetch();

    if (!$customer || !password_verify($loginPassword, $customer['password_hash'])) {
        respond(401, ['error' => 'Invalid credentials.']);
    }

    respond(200, [
        'message' => 'Logged in successfully.',
        'user' => [
            'id' => (int)$customer['id'],
            'name' => $customer['name'] ?: $customer['username'],
            'email' => $customer['email'],
            'username' => $customer['username'],
        ],
    ]);
} catch (Throwable $error) {
    respond(500, [
        'error' => 'Authentication failed.',
        'details' => $error->getMessage(),
    ]);
}
