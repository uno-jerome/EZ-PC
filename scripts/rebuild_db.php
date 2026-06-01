<?php

declare(strict_types=1);

const DEFAULT_DB_HOST = '127.0.0.1';
const DEFAULT_DB_PORT = '3306';
const DEFAULT_DB_NAME = 'itc_database_admin';
const DEFAULT_DB_USER = 'root';
const DEFAULT_DB_PASSWORD = 'root';
const DEFAULT_BRANCH_LOCATION = 'Main Warehouse';
const DEFAULT_CUSTOMER_BRANCH = 'Online';
const PLACEHOLDER_ORDER_PASSWORD = 'LegacyOrder!123';

function getCliOption(string $optionName): ?string
{
    global $argv;

    foreach ($argv ?? [] as $argument) {
        $prefix = '--' . $optionName . '=';
        if (strpos($argument, $prefix) === 0) {
            return substr($argument, strlen($prefix));
        }
    }

    return null;
}

function getenvOrDefault(string $name, string $fallback): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        return $fallback;
    }

    return $value;
}

function connectToDatabase(?string $databaseName = null): PDO
{
    $host = getenvOrDefault('DB_HOST', DEFAULT_DB_HOST);
    $port = getenvOrDefault('DB_PORT', DEFAULT_DB_PORT);
    $database = $databaseName ?? getenvOrDefault('DB_NAME', DEFAULT_DB_NAME);
    $username = getenvOrDefault('DB_USER', DEFAULT_DB_USER);
    $password = getenv('DB_PASSWORD');
    if ($password === false) {
        $password = DEFAULT_DB_PASSWORD;
    }

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

function tableExists(PDO $pdo, string $tableName): bool
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $statement->execute([$tableName]);

    return (int)$statement->fetchColumn() > 0;
}

function fetchAllIfTableExists(PDO $pdo, string $tableName, string $orderBy = ''): array
{
    if (!tableExists($pdo, $tableName)) {
        return [];
    }

    $sql = sprintf('SELECT * FROM `%s`', $tableName);
    if ($orderBy !== '') {
        $sql .= ' ORDER BY ' . $orderBy;
    }

    $stmt = $pdo->query($sql);
    if ($stmt === false) {
        throw new RuntimeException('Failed to query table: ' . $tableName);
    }

    return $stmt->fetchAll();
}

function fetchLegacySnapshot(PDO $pdo): array
{
    return [
        'customers' => fetchAllIfTableExists($pdo, 'customers', 'id ASC'),
        'users' => fetchAllIfTableExists($pdo, 'users', 'id ASC'),
        'stocks' => fetchAllIfTableExists($pdo, 'stocks', 'id ASC'),
        'product_details' => fetchAllIfTableExists($pdo, 'product_details', 'id ASC'),
        'orders' => fetchAllIfTableExists($pdo, 'orders', 'order_id ASC'),
        'order_items' => fetchAllIfTableExists($pdo, 'order_items', 'id ASC'),
    ];
}

function buildLegacySeedFromProductExport(array $exportedProducts): array
{
    $legacyStocks = [];
    $legacyProductDetails = [];

    foreach (array_values($exportedProducts) as $index => $product) {
        $itemId = trim((string)($product['id'] ?? ''));
        if ($itemId === '') {
            continue;
        }

        $legacyStocks[] = [
            'id' => $index + 1,
            'item_id' => $itemId,
            'name' => trim((string)($product['name'] ?? '')) ?: $itemId,
            'price' => (string)($product['price'] ?? 0),
            'quantity' => (string)($product['stock'] ?? 0),
            'category' => trim((string)($product['category'] ?? '')) ?: 'Uncategorized',
            'category_type' => trim((string)($product['categoryType'] ?? '')),
            'date' => $product['date'] ?? date('Y-m-d H:i:s'),
        ];

        $legacyProductDetails[] = [
            'item_id' => $itemId,
            'description' => $product['description'] ?? null,
            'specs_json' => null,
            'image_path' => $product['image'] ?? null,
            'return_policy_text' => null,
        ];
    }

    return [
        'customers' => [],
        'users' => [],
        'stocks' => $legacyStocks,
        'product_details' => $legacyProductDetails,
        'orders' => [],
        'order_items' => [],
    ];
}

function loadFallbackSnapshotFromProductJson(string $jsonFilePath): array
{
    if (!is_file($jsonFilePath)) {
        throw new RuntimeException('Product export file not found: ' . $jsonFilePath);
    }

    $json = file_get_contents($jsonFilePath);
    if ($json === false) {
        throw new RuntimeException('Unable to read product export file.');
    }

    $json = trim($json);
    if (strpos($json, 'Result:') === 0) {
        $arrayStart = strpos($json, '[');
        $arrayEnd = strrpos($json, ']');
        if ($arrayStart !== false && $arrayEnd !== false && $arrayEnd >= $arrayStart) {
            $json = substr($json, $arrayStart, $arrayEnd - $arrayStart + 1);
        }
    }

    $exportedProducts = json_decode($json, true);
    if (!is_array($exportedProducts)) {
        throw new RuntimeException('Product export file did not contain a JSON array.');
    }

    return buildLegacySeedFromProductExport($exportedProducts);
}

function printSnapshotCounts(array $snapshot, string $label): void
{
    echo $label . PHP_EOL;
    foreach ($snapshot as $key => $rows) {
        echo '  ' . $key . '=' . count($rows) . PHP_EOL;
    }
}

function inferCategoryGroup(string $category): string
{
    $category = trim($category);
    if ($category === '') {
        return '';
    }

    $groups = [
        'Components' => ['Chassis Fan', 'CPU Cooling', 'Graphics Card', 'Hard Disk', 'Memory', 'Motherboard', 'PC Case', 'Power Supply', 'Processor AMD', 'Processor Intel', 'Processor Tray', 'Solid State Drive'],
        'Peripherals' => ['CCTV', 'Headset', 'Keyboard', 'Keyboard and Mouse', 'Monitor', 'Mouse', 'Printer & Scanner', 'Projector', 'Recorder', 'Speaker', 'UPS & AVR', 'Web & Digital Camera'],
        'Accessories' => ['Cables', 'Earphones', 'Gaming Surface', 'Power Bank'],
        'PC Furnitures' => ['Chairs', 'Tables'],
        'OS & Softwares' => ['Antivirus', 'Office Applications', 'Operating System'],
        'Laptops And Mobile Devices' => ['Chromebook', 'Laptops', 'Mobile Phone', 'Tablet'],
        'Desktop' => ['Desktop package', 'all-in-one', 'mini PC'],
        'Others' => ['Apparels', 'Glasses', 'Smart Watch', 'Others'],
    ];

    foreach ($groups as $groupName => $subcategories) {
        if (in_array($category, $subcategories, true)) {
            return $groupName;
        }
    }

    return in_array($category, array_keys($groups), true) ? $category : '';
}

function parseMoney($value): float
{
    $normalized = preg_replace('/[^0-9.\-]/', '', (string)$value);
    if ($normalized === null || $normalized === '' || $normalized === '-' || $normalized === '.') {
        return 0.0;
    }

    return round((float)$normalized, 2);
}

function parseInteger($value): int
{
    $normalized = preg_replace('/[^0-9\-]/', '', (string)$value);
    if ($normalized === null || $normalized === '' || $normalized === '-') {
        return 0;
    }

    return (int)$normalized;
}

function normalizeImagePathForStorage($value): ?string
{
    $imagePath = trim((string)$value);
    if ($imagePath === '') {
        return null;
    }

    if (strlen($imagePath) > 255) {
        return null;
    }

    return $imagePath;
}

function mapLegacyOrderStatus(string $status): string
{
    $normalized = strtolower(trim($status));
    $statusMap = [
        'pending' => 'To Pay',
        'paid' => 'To Ship',
        'shipping' => 'To Receive',
        'shipped' => 'To Receive',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
        'canceled' => 'Cancelled',
        'return refund' => 'Return Refund',
    ];

    return $statusMap[$normalized] ?? (trim($status) !== '' ? trim($status) : 'To Pay');
}

function mapLegacyPaymentMethod(string $method): string
{
    $normalized = strtolower(trim($method));
    if ($normalized === '' || $normalized === 'cash') {
        return 'Cash';
    }

    if (strpos($normalized, 'card') !== false) {
        return 'Card';
    }

    if (strpos($normalized, 'delivery') !== false) {
        return 'Cash on Delivery';
    }

    return trim($method);
}

function parseSqlStatements(string $schemaSql): array
{
    $lines = preg_split('/\r\n|\r|\n/', $schemaSql);
    $delimiter = ';';
    $buffer = '';
    $statements = [];

    foreach ($lines as $line) {
        $trimmedLine = trim($line);
        if (preg_match('/^DELIMITER\s+(.+)$/i', $trimmedLine, $matches)) {
            $delimiter = trim($matches[1]);
            continue;
        }

        $buffer .= $line . PHP_EOL;
        $trimmedBuffer = rtrim($buffer);
        if ($trimmedBuffer === '') {
            continue;
        }

        if (substr($trimmedBuffer, -strlen($delimiter)) !== $delimiter) {
            continue;
        }

        $statement = substr($trimmedBuffer, 0, -strlen($delimiter));
        if (trim($statement) !== '') {
            $statements[] = $statement;
        }
        $buffer = '';
    }

    if (trim($buffer) !== '') {
        $statements[] = $buffer;
    }

    return $statements;
}

function applySchema(PDO $pdo, string $schemaFilePath): void
{
    if (!is_file($schemaFilePath)) {
        throw new RuntimeException('Schema file not found: ' . $schemaFilePath);
    }

    $pdo->exec('DROP TRIGGER IF EXISTS `trg_payments_after_update_deduct_inventory`');
    $pdo->exec('DROP TRIGGER IF EXISTS `trg_payments_after_insert_deduct_inventory`');
    $pdo->exec('DROP TRIGGER IF EXISTS `trg_order_items_after_insert_audit`');
    $pdo->exec('DROP TRIGGER IF EXISTS `trg_inventory_before_update_non_negative`');
    $pdo->exec('DROP PROCEDURE IF EXISTS `sp_record_payment`');
    $pdo->exec('DROP PROCEDURE IF EXISTS `sp_add_order_item`');
    $pdo->exec('DROP PROCEDURE IF EXISTS `sp_create_order_header`');

    $schemaSql = file_get_contents($schemaFilePath);
    if ($schemaSql === false) {
        throw new RuntimeException('Unable to read schema file.');
    }

    foreach (parseSqlStatements($schemaSql) as $statement) {
        $pdo->exec($statement);
    }
}

function migrateCustomers(PDO $pdo, array $legacyCustomers): array
{
    $insertStatement = $pdo->prepare(
        'INSERT INTO customers (id, email, username, password_hash, name, contact_number, address, branch_location, registered_at, failed_login_count, last_failed_login, account_locked, locked_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $customerIdMap = [];
    foreach ($legacyCustomers as $customer) {
        $customerId = (int)$customer['id'];
        $insertStatement->execute([
            $customerId,
            trim((string)$customer['email']),
            trim((string)$customer['username']),
            (string)$customer['password_hash'],
            trim((string)($customer['name'] ?? '')),
            trim((string)($customer['contact_number'] ?? '')) ?: null,
            trim((string)($customer['address'] ?? '')) ?: null,
            DEFAULT_CUSTOMER_BRANCH,
            $customer['registered_at'] ?? date('Y-m-d H:i:s'),
            (int)($customer['failed_login_count'] ?? 0),
            $customer['last_failed_login'] ?? null,
            (int)($customer['account_locked'] ?? 0),
            $customer['locked_until'] ?? null,
        ]);

        $customerIdMap[$customerId] = [
            'id' => $customerId,
            'email' => trim((string)$customer['email']),
            'username' => trim((string)$customer['username']),
            'name' => trim((string)($customer['name'] ?? '')),
        ];
    }

    return $customerIdMap;
}

function migrateUsers(PDO $pdo, array $legacyUsers): void
{
    $insertStatement = $pdo->prepare(
        'INSERT INTO users (id, username, password, role, failed_login_count, last_failed_login, account_locked, locked_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($legacyUsers as $user) {
        $insertStatement->execute([
            (int)$user['id'],
            trim((string)$user['username']),
            (string)$user['password'],
            trim((string)($user['role'] ?? 'admin')) ?: 'admin',
            (int)($user['failed_login_count'] ?? 0),
            $user['last_failed_login'] ?? null,
            (int)($user['account_locked'] ?? 0),
            $user['locked_until'] ?? null,
            date('Y-m-d H:i:s'),
        ]);
    }
}

function migrateCatalog(PDO $pdo, array $legacyStocks, array $legacyProductDetails): array
{
    $categoryIdByName = [];
    $insertCategory = $pdo->prepare(
        'INSERT INTO categories (category_name, category_group, created_at) VALUES (?, ?, ?)' 
    );
    $insertProduct = $pdo->prepare(
        'INSERT INTO products (id, item_id, name, category_id, category_label, category_type, created_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    );
    $insertInventory = $pdo->prepare(
        'INSERT INTO inventory (product_id, unit_price, quantity_on_hand, branch_location, size_label, date_created, date_updated, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
    );
    $insertProductDetails = $pdo->prepare(
        'INSERT INTO product_details (item_id, description, specs_json, image_path, return_policy_text, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)' 
    );

    $detailByItemId = [];
    foreach ($legacyProductDetails as $detail) {
        $detailByItemId[(string)$detail['item_id']] = $detail;
    }

    $productIdByItemId = [];
    foreach ($legacyStocks as $stock) {
        $categoryName = trim((string)($stock['category'] ?? '')) ?: 'Uncategorized';
        $categoryGroup = trim((string)($stock['category_type'] ?? '')) ?: inferCategoryGroup($categoryName);
        if (!array_key_exists($categoryName, $categoryIdByName)) {
            $insertCategory->execute([
                $categoryName,
                $categoryGroup ?: null,
                $stock['date'] ?? date('Y-m-d H:i:s'),
            ]);
            $categoryIdByName[$categoryName] = (int)$pdo->lastInsertId();
        }

        $productId = (int)$stock['id'];
        $itemId = trim((string)$stock['item_id']);
        $createdAt = $stock['date'] ?? date('Y-m-d H:i:s');

        $insertProduct->execute([
            $productId,
            $itemId,
            trim((string)$stock['name']) ?: $itemId,
            $categoryIdByName[$categoryName],
            $categoryName,
            $categoryGroup ?: null,
            $createdAt,
        ]);

        $insertInventory->execute([
            $productId,
            parseMoney($stock['price'] ?? 0),
            parseInteger($stock['quantity'] ?? 0),
            DEFAULT_BRANCH_LOCATION,
            null,
            $createdAt,
            $createdAt,
        ]);

        if (isset($detailByItemId[$itemId])) {
            $detail = $detailByItemId[$itemId];
            $insertProductDetails->execute([
                $itemId,
                $detail['description'] ?? null,
                $detail['specs_json'] ?? null,
                normalizeImagePathForStorage($detail['image_path'] ?? null),
                $detail['return_policy_text'] ?? null,
                date('Y-m-d H:i:s'),
            ]);
        }

        $productIdByItemId[$itemId] = $productId;
    }

    return $productIdByItemId;
}

function buildCustomerLookup(array $customerRows): array
{
    $lookup = [
        'email' => [],
        'username' => [],
        'name' => [],
    ];

    foreach ($customerRows as $customer) {
        $customerId = (int)$customer['id'];
        $email = strtolower(trim((string)$customer['email']));
        $username = strtolower(trim((string)$customer['username']));
        $name = strtolower(trim((string)($customer['name'] ?? '')));

        if ($email !== '') {
            $lookup['email'][$email] = $customerId;
        }
        if ($username !== '') {
            $lookup['username'][$username] = $customerId;
        }
        if ($name !== '' && !isset($lookup['name'][$name])) {
            $lookup['name'][$name] = $customerId;
        }
    }

    return $lookup;
}

function ensureCustomerForOrder(PDO $pdo, array $order, array &$lookup, int &$nextCustomerId): int
{
    $email = strtolower(trim((string)($order['customer_email'] ?? '')));
    $username = strtolower(trim((string)($order['customer_username'] ?? '')));
    $name = trim((string)($order['customer_name'] ?? ''));
    $nameKey = strtolower($name);

    if ($email !== '' && isset($lookup['email'][$email])) {
        return $lookup['email'][$email];
    }
    if ($username !== '' && isset($lookup['username'][$username])) {
        return $lookup['username'][$username];
    }
    if ($nameKey !== '' && isset($lookup['name'][$nameKey])) {
        return $lookup['name'][$nameKey];
    }

    $customerId = $nextCustomerId++;
    $placeholderEmail = $email !== '' ? $email : sprintf('legacy-order-%d@example.local', (int)$order['order_id']);
    $placeholderUsername = $username !== '' ? $username : sprintf('legacy_order_%d', (int)$order['order_id']);
    $placeholderName = $name !== '' ? $name : sprintf('Legacy Order %d', (int)$order['order_id']);

    $insertStatement = $pdo->prepare(
        'INSERT INTO customers (id, email, username, password_hash, name, contact_number, address, branch_location, registered_at, failed_login_count, last_failed_login, account_locked, locked_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL)'
    );
    $insertStatement->execute([
        $customerId,
        $placeholderEmail,
        $placeholderUsername,
        password_hash(PLACEHOLDER_ORDER_PASSWORD, PASSWORD_DEFAULT),
        $placeholderName,
        trim((string)($order['contact_number'] ?? '')) ?: null,
        trim((string)($order['customer_address'] ?? '')) ?: null,
        DEFAULT_CUSTOMER_BRANCH,
        $order['order_date'] ?? date('Y-m-d H:i:s'),
    ]);

    $lookup['email'][strtolower($placeholderEmail)] = $customerId;
    $lookup['username'][strtolower($placeholderUsername)] = $customerId;
    $lookup['name'][strtolower($placeholderName)] = $customerId;

    return $customerId;
}

function migrateOrders(PDO $pdo, array $legacyOrders, array $legacyOrderItems, array $productIdByItemId, array $customerRows): void
{
    if ($legacyOrders === []) {
        return;
    }

    $customerLookup = buildCustomerLookup($customerRows);
    $nextCustomerId = $customerRows === []
        ? 1
        : (max(array_map(static function (array $customer): int {
            return (int)$customer['id'];
        }, $customerRows)) + 1);

    $itemsByOrderId = [];
    foreach ($legacyOrderItems as $item) {
        $itemsByOrderId[(int)$item['order_id']][] = $item;
    }

    $insertOrder = $pdo->prepare(
        'INSERT INTO orders (order_id, customer_id, order_date, status, subtotal, vat_amount, shipping_fee, grand_total, payment_method, contact_number, shipping_address, branch_location, placed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertOrderItem = $pdo->prepare(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, item_snapshot_name) VALUES (?, ?, ?, ?, ?)'
    );
    $insertPayment = $pdo->prepare(
        'INSERT INTO payments (order_id, transaction_amount, payment_date, payment_status, reference_number, method) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $productNameStatement = $pdo->prepare('SELECT name FROM products WHERE id = ? LIMIT 1');

    foreach ($legacyOrders as $order) {
        $orderId = (int)$order['order_id'];
        $customerId = ensureCustomerForOrder($pdo, $order, $customerLookup, $nextCustomerId);
        $mappedStatus = mapLegacyOrderStatus((string)($order['status'] ?? ''));
        $mappedPaymentMethod = mapLegacyPaymentMethod((string)($order['payment_method'] ?? 'Cash'));
        $subtotal = parseMoney($order['total_amount'] ?? 0);
        $vatAmount = parseMoney($order['vat_amount'] ?? 0);
        $grandTotal = parseMoney($order['grand_total'] ?? 0);
        if ($grandTotal <= 0) {
            $grandTotal = round($subtotal + $vatAmount, 2);
        }
        $shippingFee = round(max(0, $grandTotal - $subtotal - $vatAmount), 2);

        $insertOrder->execute([
            $orderId,
            $customerId,
            $order['order_date'] ?? date('Y-m-d H:i:s'),
            $mappedStatus,
            $subtotal,
            $vatAmount,
            $shippingFee,
            $grandTotal,
            $mappedPaymentMethod,
            trim((string)($order['contact_number'] ?? '')) ?: null,
            trim((string)($order['customer_address'] ?? '')) ?: null,
            DEFAULT_BRANCH_LOCATION,
            trim((string)($order['customer_username'] ?? '')) ?: trim((string)($order['customer_name'] ?? '')) ?: null,
        ]);

        foreach ($itemsByOrderId[$orderId] ?? [] as $item) {
            $itemId = trim((string)($item['item_id'] ?? ''));
            if ($itemId === '' || !isset($productIdByItemId[$itemId])) {
                continue;
            }

            $productId = $productIdByItemId[$itemId];
            $productNameStatement->execute([$productId]);
            $productName = (string)$productNameStatement->fetchColumn();

            $insertOrderItem->execute([
                $orderId,
                $productId,
                max(1, parseInteger($item['quantity'] ?? 1)),
                parseMoney($item['price'] ?? 0),
                $productName !== '' ? $productName : $itemId,
            ]);
        }

        $paymentStatus = $mappedStatus === 'To Pay' ? 'Pending' : 'Paid';
        $insertPayment->execute([
            $orderId,
            $grandTotal,
            $order['order_date'] ?? date('Y-m-d H:i:s'),
            $paymentStatus,
            sprintf('legacy-order-%d', $orderId),
            $mappedPaymentMethod,
        ]);
    }
}

function printSummary(PDO $pdo): void
{
    $tables = ['customers', 'categories', 'products', 'inventory', 'product_details', 'orders', 'order_items', 'payments'];
    echo 'Migration complete.' . PHP_EOL;
    foreach ($tables as $table) {
        if (!tableExists($pdo, $table)) {
            echo $table . '=missing' . PHP_EOL;
            continue;
        }
        $countStmt = $pdo->query(sprintf('SELECT COUNT(*) FROM `%s`', $table));
        if ($countStmt === false) {
            throw new RuntimeException('Failed to query count for table: ' . $table);
        }
        $count = $countStmt->fetchColumn();
        echo $table . '=' . $count . PHP_EOL;
    }
}

try {
    $projectRoot = dirname(__DIR__);
    $canonicalSchemaFileName = 'item_database_structure_new.sql';
    $preferredSchemaFilePath = $projectRoot . DIRECTORY_SEPARATOR . $canonicalSchemaFileName;
    if (!is_file($preferredSchemaFilePath)) {
        throw new RuntimeException('Missing canonical schema file: ' . $canonicalSchemaFileName);
    }
    $schemaFilePath = $preferredSchemaFilePath;
    $fallbackProductJsonPath = getCliOption('product-json');

    echo 'Connecting to current database...' . PHP_EOL;
    $pdo = connectToDatabase();

    echo 'Snapshotting legacy data...' . PHP_EOL;
    $legacySnapshot = fetchLegacySnapshot($pdo);
    printSnapshotCounts($legacySnapshot, 'Snapshot counts before apply:');

    if ($fallbackProductJsonPath !== null) {
        echo 'Using product export fallback for catalog seed...' . PHP_EOL;
        $fallbackSnapshot = loadFallbackSnapshotFromProductJson($fallbackProductJsonPath);
        $legacySnapshot['stocks'] = $fallbackSnapshot['stocks'];
        $legacySnapshot['product_details'] = $fallbackSnapshot['product_details'];
        printSnapshotCounts($legacySnapshot, 'Fallback snapshot counts:');
    }

    if ($legacySnapshot['stocks'] === [] && $legacySnapshot['customers'] === [] && $legacySnapshot['users'] === []) {
        throw new RuntimeException('Legacy snapshot is empty. Aborting apply to avoid replacing the database with no recoverable seed data.');
    }

    echo 'Canonical final schema file: ' . $canonicalSchemaFileName . PHP_EOL;
    echo 'Schema file selected for apply: ' . basename($schemaFilePath) . PHP_EOL;

    echo 'Applying normalized schema...' . PHP_EOL;
    applySchema($pdo, $schemaFilePath);

    echo 'Reconnecting to refreshed schema...' . PHP_EOL;
    $pdo = connectToDatabase();

    echo 'Migrating customers...' . PHP_EOL;
    $customerIdMap = migrateCustomers($pdo, $legacySnapshot['customers']);

    echo 'Migrating admin users...' . PHP_EOL;
    migrateUsers($pdo, $legacySnapshot['users']);

    echo 'Migrating catalog...' . PHP_EOL;
    $productIdByItemId = migrateCatalog($pdo, $legacySnapshot['stocks'], $legacySnapshot['product_details']);

    echo 'Migrating historical orders...' . PHP_EOL;
    migrateOrders($pdo, $legacySnapshot['orders'], $legacySnapshot['order_items'], $productIdByItemId, array_values($customerIdMap));

    printSummary($pdo);
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Migration failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
