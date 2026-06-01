<?php

declare(strict_types=1);

const DEFAULT_DB_HOST = '127.0.0.1';
const DEFAULT_DB_PORT = '3306';
const DEFAULT_DB_NAME = 'itc_database_admin';
const DEFAULT_DB_USER = 'root';
const DEFAULT_DB_PASSWORD = 'root';

function getenvOrDefault(string $name, string $fallback): string
{
    $value = getenv($name);
    return ($value === false || $value === '') ? $fallback : $value;
}

function connectToDatabase(): PDO
{
    $host = getenvOrDefault('DB_HOST', DEFAULT_DB_HOST);
    $port = getenvOrDefault('DB_PORT', DEFAULT_DB_PORT);
    $database = getenvOrDefault('DB_NAME', DEFAULT_DB_NAME);
    $username = getenvOrDefault('DB_USER', DEFAULT_DB_USER);
    $passwordEnv = getenv('DB_PASSWORD');
    $password = ($passwordEnv === false) ? DEFAULT_DB_PASSWORD : $passwordEnv;

    return new PDO(
        sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database),
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
}

function fetchExistingNames(PDO $pdo, string $sql, array $parameters = []): array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($parameters);
    $rows = $statement->fetchAll(PDO::FETCH_COLUMN);

    return array_map('strval', $rows ?: []);
}

function printSectionStatus(string $label, array $expectedNames, array $existingNames): bool
{
    $existingLookup = array_fill_keys($existingNames, true);
    $missingNames = [];

    echo $label . PHP_EOL;
    foreach ($expectedNames as $name) {
        $isPresent = isset($existingLookup[$name]);
        echo sprintf('  [%s] %s', $isPresent ? 'OK' : 'MISSING', $name) . PHP_EOL;
        if (!$isPresent) {
            $missingNames[] = $name;
        }
    }

    if ($missingNames === []) {
        echo '  Summary: all present.' . PHP_EOL;
        return true;
    }

    echo '  Summary: missing ' . implode(', ', $missingNames) . PHP_EOL;
    return false;
}

try {
    $pdo = connectToDatabase();

    $requiredTables = [
        'categories',
        'customers',
        'products',
        'inventory',
        'product_details',
        'orders',
        'order_items',
        'payments',
        'stock_audit',
    ];
    $requiredProcedures = [
        'sp_create_order_header',
        'sp_add_order_item',
        'sp_record_payment',
    ];
    $requiredTriggers = [
        'trg_inventory_before_update_non_negative',
        'trg_inventory_after_update_audit',
        'trg_order_items_after_insert_audit',
        'trg_payments_after_insert_deduct_inventory',
        'trg_payments_after_update_deduct_inventory',
    ];

    $existingTables = fetchExistingNames(
        $pdo,
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    $existingProcedures = fetchExistingNames(
        $pdo,
        'SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = ?',
        ['PROCEDURE']
    );
    $existingTriggers = fetchExistingNames(
        $pdo,
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()'
    );

    echo 'Demo status check' . PHP_EOL;
    echo 'Database: ' . getenvOrDefault('DB_NAME', DEFAULT_DB_NAME) . PHP_EOL . PHP_EOL;

    $tablesOk = printSectionStatus('Normalized tables', $requiredTables, $existingTables);
    echo PHP_EOL;
    $proceduresOk = printSectionStatus('Stored procedures', $requiredProcedures, $existingProcedures);
    echo PHP_EOL;
    $triggersOk = printSectionStatus('Triggers', $requiredTriggers, $existingTriggers);
    echo PHP_EOL;

    $allOk = $tablesOk && $proceduresOk && $triggersOk;
    echo $allOk ? 'Overall status: READY FOR DEMO' : 'Overall status: NOT READY FOR DEMO';
    echo PHP_EOL;

    exit($allOk ? 0 : 1);
} catch (Throwable $error) {
    fwrite(STDERR, 'Demo status check failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}