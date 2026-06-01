<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DEFAULT_DB_HOST = '127.0.0.1';
const DEFAULT_DB_PORT = '3306';
const DEFAULT_DB_NAME = 'itc_database_admin';
const DEFAULT_DB_USER = 'root';
const DEFAULT_DB_PASSWORD = 'root';
const DEFAULT_BRANCH_LOCATION = 'Main Warehouse';
const SHIPPING_THRESHOLD = 50.0;
const SHIPPING_FEE = 9.99;
const STATUS_TO_PAY = 'To Pay';
const STATUS_TO_SHIP = 'To Ship';
const STATUS_TO_RECEIVE = 'To Receive';
const STATUS_COMPLETED = 'Completed';
const STATUS_CANCELLED = 'Cancelled';
const STATUS_RETURN_REFUND = 'Return Refund';
const PAYMENT_METHOD_CARD = 'Card';
const PAYMENT_METHOD_COD = 'Cash on Delivery';
const PAYMENT_STATUS_PAID = 'Paid';
const PAYMENT_STATUS_PENDING = 'Pending';
// Note: VAT is display-only in the frontend (prices in DB are VAT-inclusive).
// Server uses stored procedures to compute stored totals; do not hardcode VAT here.

function respond($statusCode, $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function getenvOrDefault($name, $fallback)
{
    $value = getenv($name);
    return ($value === false || $value === '') ? $fallback : $value;
}

function getConnection()
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

function readJsonBody()
{
    $rawInput = (string) file_get_contents('php://input');
    $body = json_decode($rawInput, true);
    return is_array($body) ? $body : [];
}

function normalizePaymentMethod($value)
{
    $normalized = strtolower(trim((string)$value));
    if ($normalized === 'card') {
        return PAYMENT_METHOD_CARD;
    }

    if ($normalized === 'cash_on_delivery' || $normalized === 'cash on delivery') {
        return PAYMENT_METHOD_COD;
    }

    return PAYMENT_METHOD_CARD;
}

function validateCustomerId($value)
{
    $customerId = (int)$value;
    if ($customerId <= 0) {
        respond(400, ['error' => 'A valid customer ID is required.']);
    }

    return $customerId;
}

function normalizeItems($items)
{
    if (!is_array($items) || $items === []) {
        respond(400, ['error' => 'At least one order item is required.']);
    }

    $normalizedItems = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $itemId = trim((string)($item['productId'] ?? $item['itemId'] ?? ''));
        $quantity = (int)($item['quantity'] ?? 0);
        if ($itemId === '' || $quantity <= 0) {
            continue;
        }

        $normalizedItems[] = [
            'itemId' => $itemId,
            'quantity' => $quantity,
        ];
    }

    if ($normalizedItems === []) {
        respond(400, ['error' => 'The order items were invalid.']);
    }

    return $normalizedItems;
}

function getCustomerRow($pdo, $customerId)
{
    $statement = $pdo->prepare('SELECT id, name, email, username FROM customers WHERE id = ? LIMIT 1');
    if ($statement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $statement->execute([$customerId]);
    $customer = $statement->fetch();
    if (!$customer) {
        respond(404, ['error' => 'Customer not found.']);
    }

    return $customer;
}

function fetchProductMap($pdo, $items, $branchLocation)
{
    $itemIds = array_values(array_unique(array_map(static function ($item) {
        return $item['itemId'];
    }, $items)));

    if ($itemIds === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
    $sql = "
        SELECT
            p.id AS product_id,
            p.item_id,
            p.name,
            COALESCE(MAX(CASE WHEN i.branch_location = ? AND i.is_deleted = 0 THEN i.unit_price END), 0.00) AS unit_price,
            COALESCE(SUM(CASE WHEN i.branch_location = ? AND i.is_deleted = 0 THEN i.quantity_on_hand ELSE 0 END), 0) AS branch_stock,
            COALESCE(pd.image_path, '') AS image_path
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        LEFT JOIN product_details pd ON pd.item_id = p.item_id
        WHERE p.item_id IN ($placeholders)
          AND p.is_deleted = 0
        GROUP BY p.id, p.item_id, p.name, pd.image_path
    ";

    $statement = $pdo->prepare($sql);
    if ($statement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $statement->execute(array_merge([$branchLocation, $branchLocation], $itemIds));

    $productMap = [];
    while ($row = $statement->fetch()) {
        $productMap[(string)$row['item_id']] = $row;
    }

    return $productMap;
}

function buildShippingAddress($body)
{
    $parts = [
        trim((string)($body['addressLine'] ?? '')),
        trim((string)($body['barangay'] ?? '')),
        trim((string)($body['cityMunicipality'] ?? '')),
        trim((string)($body['province'] ?? '')),
        trim((string)($body['country'] ?? 'Philippines')),
    ];

    $parts = array_values(array_filter($parts, static function ($part) {
        return $part !== '';
    }));

    return implode(', ', $parts);
}

function formatOrderForResponse($orderRow, $itemsByOrderId)
{
    $orderId = (string)$orderRow['order_id'];
    return [
        'id' => $orderId,
        'date' => $orderRow['order_date'],
        'status' => $orderRow['status'],
        'paymentMethod' => $orderRow['payment_method'],
        'paymentStatus' => $orderRow['payment_status'] ?? null,
        'subtotal' => (float)$orderRow['subtotal'],
        'shipping' => (float)$orderRow['shipping_fee'],
        'tax' => (float)$orderRow['vat_amount'],
        'total' => (float)$orderRow['grand_total'],
        'items' => $itemsByOrderId[$orderId] ?? [],
    ];
}

function fetchOrdersForCustomer($pdo, $customerId)
{
    $orderStatement = $pdo->prepare(
        'SELECT o.order_id, o.order_date, o.status, o.subtotal, o.vat_amount, o.shipping_fee, o.grand_total, o.payment_method, pay.payment_status
         FROM orders o
         LEFT JOIN payments pay ON pay.order_id = o.order_id
         WHERE o.customer_id = ?
         ORDER BY o.order_date DESC, o.order_id DESC'
    );
    if ($orderStatement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $orderStatement->execute([$customerId]);
    $orders = $orderStatement->fetchAll();

    if ($orders === []) {
        return [];
    }

    $orderIds = array_map(static function ($order) {
        return (int)$order['order_id'];
    }, $orders);
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $itemStatement = $pdo->prepare(
        "SELECT oi.order_id, oi.quantity, oi.unit_price, COALESCE(oi.item_snapshot_name, p.name) AS item_name, COALESCE(pd.image_path, '') AS image_path
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_details pd ON pd.item_id = p.item_id
         WHERE oi.order_id IN ($placeholders)
         ORDER BY oi.id ASC"
    );
    if ($itemStatement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $itemStatement->execute($orderIds);

    $itemsByOrderId = [];
    while ($item = $itemStatement->fetch()) {
        $key = (string)$item['order_id'];
        if (!array_key_exists($key, $itemsByOrderId)) {
            $itemsByOrderId[$key] = [];
        }
        $itemsByOrderId[$key][] = [
            'name' => $item['item_name'],
            'image' => $item['image_path'],
            'price' => (float)$item['unit_price'],
            'quantity' => (int)$item['quantity'],
        ];
    }

    return array_map(static function ($order) use ($itemsByOrderId) {
        return formatOrderForResponse($order, $itemsByOrderId);
    }, $orders);
}

function ensureOrderBelongsToCustomer($pdo, $orderId, $customerId)
{
    $statement = $pdo->prepare('SELECT order_id, status, payment_method FROM orders WHERE order_id = ? AND customer_id = ? LIMIT 1');
    if ($statement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $statement->execute([$orderId, $customerId]);
    $order = $statement->fetch();
    if (!$order) {
        respond(404, ['error' => 'Order not found for this customer.']);
    }

    return $order;
}

function callCreateOrderHeaderProcedure($pdo, $customerId, $paymentMethod, $contactNumber, $shippingAddress, $branchLocation, $shippingFee)
{
    // Use the existing stored procedure to create the order header and let
    // database-side logic compute subtotal/vat/grand_total based on order_items.
    $stmt = $pdo->prepare('CALL sp_create_order_header(?, ?, ?, ?, ?, ?, @out_order_id)');
    $stmt->execute([
        $customerId,
        $paymentMethod,
        $contactNumber,
        $shippingAddress,
        $branchLocation,
        $shippingFee,
    ]);
    // Retrieve the OUT parameter set by the stored procedure
    $selectStmt = $pdo->query('SELECT @out_order_id AS order_id');
    if ($selectStmt === false) {
        throw new RuntimeException('Failed to retrieve created order id.');
    }
    /** @var PDOStatement $selectStmt */
    $row = $selectStmt->fetch();
    $orderId = isset($row['order_id']) ? (int)$row['order_id'] : 0;
    if ($orderId <= 0) {
        throw new RuntimeException('Failed to create order in database.');
    }

    return $orderId;
}

function callAddOrderItemProcedure($pdo, $orderId, $itemId, $quantity)
{
    $statement = $pdo->prepare('CALL sp_add_order_item(?, ?, ?)');
    $statement->execute([$orderId, $itemId, $quantity]);
    $statement->closeCursor();
}

function fetchPaymentForOrder($pdo, $orderId)
{
    $statement = $pdo->prepare('SELECT transaction_amount, method, payment_status, reference_number FROM payments WHERE order_id = ? LIMIT 1');
    if ($statement === false) {
        respond(500, ['error' => 'Database error.']);
    }
    $statement->execute([$orderId]);
    $payment = $statement->fetch();
    if (!$payment) {
        respond(404, ['error' => 'Payment not found for this order.']);
    }

    return $payment;
}

function callRecordPaymentProcedure($pdo, $orderId, $amount, $method, $status, $referenceNumber)
{
    $statement = $pdo->prepare('CALL sp_record_payment(?, ?, ?, ?, ?)');
    $statement->execute([
        $orderId,
        $amount,
        $method,
        $status,
        $referenceNumber,
    ]);
    $statement->closeCursor();
}

function restoreInventoryForLineItems($pdo, $lineItems, $branchLocation)
{
    if (!is_array($lineItems) || $lineItems === []) {
        return;
    }

    $inventoryRestore = $pdo->prepare(
        'UPDATE inventory
         SET quantity_on_hand = quantity_on_hand + ?
         WHERE product_id = ?
           AND branch_location = ?
           AND is_deleted = 0'
    );

    foreach ($lineItems as $lineItem) {
        $inventoryRestore->execute([
            $lineItem['quantity'],
            $lineItem['productId'],
            $branchLocation,
        ]);
    }
}

function deleteOrderForCleanup($pdo, $orderId)
{
    if ($orderId <= 0) {
        return;
    }

    $statement = $pdo->prepare('DELETE FROM orders WHERE order_id = ?');
    $statement->execute([$orderId]);
}

function fetchSingleOrderForCustomer($pdo, $customerId, $orderId)
{
    $orders = fetchOrdersForCustomer($pdo, $customerId);
    foreach ($orders as $order) {
        if ((string)$order['id'] === (string)$orderId) {
            return $order;
        }
    }

    return null;
}

function createOrder($pdo, $body)
{
    $customerId = validateCustomerId($body['customerId'] ?? 0);
    $items = normalizeItems($body['items'] ?? []);
    $customer = getCustomerRow($pdo, $customerId);
    $paymentMethod = normalizePaymentMethod($body['paymentMethod'] ?? 'card');
    $branchLocation = trim((string)($body['branchLocation'] ?? DEFAULT_BRANCH_LOCATION)) ?: DEFAULT_BRANCH_LOCATION;
    $contactNumber = trim((string)($body['phone'] ?? ''));
    $shippingAddress = buildShippingAddress($body);

    $productMap = fetchProductMap($pdo, $items, $branchLocation);
    if (count($productMap) !== count(array_unique(array_column($items, 'itemId')))) {
        respond(400, ['error' => 'One or more products could not be found in the database.']);
    }

    $lineItems = [];
    $subtotal = 0.0;
    foreach ($items as $item) {
        $product = $productMap[$item['itemId']] ?? null;
        if (!$product) {
            respond(400, ['error' => 'A product in the order is missing.']);
        }

        if ((int)$product['branch_stock'] < $item['quantity']) {
            respond(400, ['error' => sprintf('Not enough stock for %s.', $product['name'])]);
        }

        $unitPrice = round((float)$product['unit_price'], 2);
        $lineItems[] = [
            'productId' => (int)$product['product_id'],
            'itemId' => $item['itemId'],
            'name' => $product['name'],
            'quantity' => $item['quantity'],
            'unitPrice' => $unitPrice,
        ];
        $subtotal += $unitPrice * $item['quantity'];
    }

    $subtotal = round($subtotal, 2);
    $shippingFee = $subtotal > SHIPPING_THRESHOLD ? 0.0 : SHIPPING_FEE;
    $paymentStatus = $paymentMethod === PAYMENT_METHOD_CARD ? PAYMENT_STATUS_PAID : PAYMENT_STATUS_PENDING;

    $orderId = 0;
    $inventoryDeducted = false;
    try {
        $orderId = callCreateOrderHeaderProcedure(
            $pdo,
            $customerId,
            $paymentMethod,
            $contactNumber,
            $shippingAddress,
            $branchLocation,
            $shippingFee
        );

        foreach ($lineItems as $lineItem) {
            callAddOrderItemProcedure($pdo, $orderId, $lineItem['itemId'], $lineItem['quantity']);
        }

        $orderRow = fetchSingleOrderForCustomer($pdo, $customerId, $orderId);
        if (!$orderRow) {
            throw new RuntimeException('Unable to load the created order from the database.');
        }

        callRecordPaymentProcedure(
            $pdo,
            $orderId,
            $orderRow['total'],
            $paymentMethod,
            $paymentStatus,
            sprintf('web-order-%d', $orderId)
        );

        if ($paymentStatus === PAYMENT_STATUS_PAID) {
            $inventoryDeducted = true;
        }

        if ($paymentMethod === PAYMENT_METHOD_COD) {
            $inventoryUpdate = $pdo->prepare(
                'UPDATE inventory
                 SET quantity_on_hand = quantity_on_hand - ?
                 WHERE product_id = ?
                   AND branch_location = ?
                   AND is_deleted = 0
                   AND quantity_on_hand >= ?'
            );

            foreach ($lineItems as $lineItem) {
                $inventoryUpdate->execute([
                    $lineItem['quantity'],
                    $lineItem['productId'],
                    $branchLocation,
                    $lineItem['quantity'],
                ]);

                if ($inventoryUpdate->rowCount() !== 1) {
                    throw new RuntimeException('Unable to update inventory for the order.');
                }
            }

            $inventoryDeducted = true;
        }

        $orderRow = fetchSingleOrderForCustomer($pdo, $customerId, $orderId);
        if (!$orderRow) {
            throw new RuntimeException('Unable to load the saved order response.');
        }

        respond(201, [
            'message' => 'Order placed successfully.',
            'order' => $orderRow,
        ]);
    } catch (Throwable $error) {
        if ($inventoryDeducted) {
            restoreInventoryForLineItems($pdo, $lineItems, $branchLocation);
        }

        deleteOrderForCleanup($pdo, $orderId);

        respond(500, [
            'error' => 'Failed to create order.',
            'details' => $error->getMessage(),
        ]);
    }
}

function updateOrder($pdo, $body)
{
    $customerId = validateCustomerId($body['customerId'] ?? 0);
    $orderId = (int)($body['orderId'] ?? 0);
    if ($orderId <= 0) {
        respond(400, ['error' => 'A valid order ID is required.']);
    }

    $action = strtolower(trim((string)($body['action'] ?? '')));
    $order = ensureOrderBelongsToCustomer($pdo, $orderId, $customerId);

    $pdo->beginTransaction();
    try {
        if ($action === 'pay') {
            $payment = fetchPaymentForOrder($pdo, $orderId);
            $pdo->commit();
            callRecordPaymentProcedure(
                $pdo,
                $orderId,
                (float)$payment['transaction_amount'],
                $payment['method'],
                PAYMENT_STATUS_PAID,
                $payment['reference_number'] ?: sprintf('web-order-%d', $orderId)
            );
            respond(200, ['message' => 'Order updated successfully.']);
        } elseif ($action === 'cancel') {
            $orderUpdate = $pdo->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
            $orderUpdate->execute([STATUS_CANCELLED, $orderId]);
        } elseif ($action === 'confirm_received') {
            $orderUpdate = $pdo->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
            $orderUpdate->execute([STATUS_COMPLETED, $orderId]);
        } elseif ($action === 'return_refund') {
            $orderUpdate = $pdo->prepare('UPDATE orders SET status = ? WHERE order_id = ?');
            $orderUpdate->execute([STATUS_RETURN_REFUND, $orderId]);
        } else {
            respond(400, ['error' => 'Unsupported order action.']);
        }

        $pdo->commit();
        respond(200, ['message' => 'Order updated successfully.']);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        respond(500, [
            'error' => 'Failed to update order.',
            'details' => $error->getMessage(),
        ]);
    }
}

try {
    $pdo = getConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $customerId = validateCustomerId($_GET['customerId'] ?? 0);
        respond(200, ['orders' => fetchOrdersForCustomer($pdo, $customerId)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['error' => 'Method not allowed.']);
    }

    $body = readJsonBody();
    $action = strtolower(trim((string)($body['action'] ?? 'create')));
    if ($action === 'create') {
        createOrder($pdo, $body);
    }

    updateOrder($pdo, $body);
} catch (Throwable $error) {
    respond(500, [
        'error' => 'Orders API failed.',
        'details' => $error->getMessage(),
    ]);
}
