<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

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

function normalize_image_path($imagePath)
{
    $imagePath = trim((string) $imagePath);
    if ($imagePath === '') {
        return '';
    }

    if (strpos($imagePath, '//') === 0) {
        return 'https:' . $imagePath;
    }

    return $imagePath;
}

function infer_category_type($category)
{
    $category = trim((string) $category);
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

    foreach ($groups as $mainCategory => $subcategories) {
        if (in_array($category, $subcategories, true)) {
            return $mainCategory;
        }
    }

    return in_array($category, array_keys($groups), true) ? $category : '';
}

try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $sql = '
        SELECT
            p.id,
            p.item_id,
            p.name,
            COALESCE(MAX(i.unit_price), 0.00) AS price,
            COALESCE(SUM(i.quantity_on_hand), 0) AS quantity,
            COALESCE(NULLIF(TRIM(p.category_label), \'\'), c.category_name, \'Uncategorized\') AS category,
            p.created_at AS date,
            pd.description,
            pd.specs_json,
            pd.image_path,
            COALESCE(NULLIF(TRIM(p.category_type), \'\'), c.category_group, \'\') AS category_type
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN inventory i ON i.product_id = p.id AND i.is_deleted = 0
        LEFT JOIN product_details pd ON pd.item_id = p.item_id
        WHERE p.is_deleted = 0
        GROUP BY
            p.id,
            p.item_id,
            p.name,
            p.category_label,
            c.category_name,
            p.created_at,
            pd.description,
            pd.specs_json,
            pd.image_path,
            p.category_type,
            c.category_group
        ORDER BY category ASC, p.name ASC, p.created_at DESC, p.id DESC
    ';

    $statement = $pdo->query($sql);
    if ($statement === false) {
        throw new RuntimeException('Failed to query products.');
    }
    /** @var PDOStatement $statement */

    $products = [];
    while ($row = $statement->fetch()) {
        $price = preg_replace('/[^0-9.\-]/', '', (string) $row['price']);
        $quantity = (int) ($row['quantity'] ?? 0);
        $name = (string) ($row['name'] ?? 'Product');
        $category = trim((string) ($row['category'] ?? 'Uncategorized')) ?: 'Uncategorized';
        $categoryType = trim((string) ($row['category_type'] ?? ''));
        if ($categoryType === '') {
            $categoryType = infer_category_type($category);
        }
        $safeName = preg_replace('/[<>&]/', '', $name);
        $initials = strtoupper(substr(trim(preg_replace('/\s+/', ' ', $safeName)), 0, 2)) ?: 'P';
        $imagePath = normalize_image_path($row['image_path'] ?? '');
        $svg = sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%%" stop-color="#111827" /><stop offset="100%%" stop-color="#4f46e5" /></linearGradient></defs><rect width="640" height="640" rx="48" fill="url(#bg)" /><circle cx="520" cy="120" r="96" fill="rgba(255,255,255,0.08)" /><circle cx="120" cy="520" r="120" fill="rgba(255,255,255,0.06)" /><text x="50%%" y="50%%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="160" font-weight="700">%s</text><text x="50%%" y="73%%" dominant-baseline="middle" text-anchor="middle" fill="#e5e7eb" font-family="Arial, sans-serif" font-size="38" font-weight="400">%s</text></svg>',
            htmlspecialchars($initials, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars(substr($safeName, 0, 26), ENT_QUOTES, 'UTF-8')
        );

        $description = trim((string) ($row['description'] ?? ''));
        if ($description === '') {
            $description = sprintf('%s from the EasyPC catalog.', $name);
        }

        $products[] = [
            'id' => (string) ($row['item_id'] ?: $row['id']),
            'name' => $name,
            'price' => is_numeric($price) ? (float) $price : 0,
            'category' => $category,
            'categoryType' => $categoryType,
            'date' => (string) ($row['date'] ?? ''),
            'description' => $description,
            'image' => $imagePath !== '' ? $imagePath : 'data:image/svg+xml;charset=UTF-8,' . rawurlencode($svg),
            'rating' => (float) number_format(4 + (((int) $row['id']) % 10) / 10, 1),
            'stock' => $quantity,
        ];
    }

    echo json_encode($products, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to load products from the database.',
        'details' => $error->getMessage(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
