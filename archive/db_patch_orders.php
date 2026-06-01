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

try {
    $pdo = connectToDatabase();
    $pdo->exec("ALTER TABLE orders MODIFY status varchar(50) NOT NULL DEFAULT 'To Ship'");
    $pdo->exec('DROP PROCEDURE IF EXISTS `sp_create_order_header`');
    $pdo->exec('DROP PROCEDURE IF EXISTS `sp_add_order_item`');
   $pdo->exec('DROP PROCEDURE IF EXISTS `sp_record_payment`');

    $pdo->exec(<<<'SQL'
CREATE PROCEDURE `sp_create_order_header`(
  IN p_customer_id INT,
  IN p_payment_method VARCHAR(50),
  IN p_contact_number VARCHAR(50),
  IN p_shipping_address VARCHAR(255),
  IN p_branch_location VARCHAR(100),
  IN p_shipping_fee DECIMAL(10,2),
  OUT p_order_id BIGINT
)
BEGIN
  DECLARE customer_exists INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT COUNT(*) INTO customer_exists
  FROM `customers`
  WHERE `id` = p_customer_id;

  IF customer_exists = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Customer does not exist.';
  END IF;

  START TRANSACTION;

  SET @order_customer_id = p_customer_id;
  SET @order_payment_method = p_payment_method;
  SET @order_contact_number = p_contact_number;
  SET @order_shipping_address = p_shipping_address;
  SET @order_branch_location = p_branch_location;
  SET @order_shipping_fee = p_shipping_fee;
  SET @order_status = 'To Ship';
  SET @order_placed_by = (
    SELECT `username`
    FROM `customers`
    WHERE `id` = p_customer_id
    LIMIT 1
  );

  SET @sql_insert_order = '
    INSERT INTO orders (
      customer_id,
      order_date,
      status,
      subtotal,
      vat_amount,
      shipping_fee,
      grand_total,
      payment_method,
      contact_number,
      shipping_address,
      branch_location,
      placed_by
    ) VALUES (?, NOW(), ?, 0.00, 0.00, ?, ?, ?, ?, ?, ?, ?)';

  PREPARE stmt_insert_order FROM @sql_insert_order;
  EXECUTE stmt_insert_order USING
    @order_customer_id,
    @order_status,
    @order_shipping_fee,
    @order_shipping_fee,
    @order_payment_method,
    @order_contact_number,
    @order_shipping_address,
    @order_branch_location,
    @order_placed_by;
  DEALLOCATE PREPARE stmt_insert_order;

  SET p_order_id = LAST_INSERT_ID();

  COMMIT;
END
SQL);

    $pdo->exec(<<<'SQL'
CREATE PROCEDURE `sp_add_order_item`(
  IN p_order_id BIGINT,
  IN p_item_id VARCHAR(50),
  IN p_quantity INT
)
BEGIN
  DECLARE v_product_id INT DEFAULT NULL;
  DECLARE v_unit_price DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_available_quantity INT DEFAULT 0;
  DECLARE v_subtotal DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_shipping_fee DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_vat_rate DECIMAL(5,4) DEFAULT 0.08;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Quantity must be greater than zero.';
  END IF;

  SELECT p.`id`, COALESCE(MAX(i.`unit_price`), 0.00), COALESCE(SUM(i.`quantity_on_hand`), 0)
  INTO v_product_id, v_unit_price, v_available_quantity
  FROM `products` p
  INNER JOIN `orders` o ON o.`order_id` = p_order_id
  LEFT JOIN `inventory` i ON i.`product_id` = p.`id`
    AND i.`is_deleted` = 0
    AND i.`branch_location` = o.`branch_location`
  WHERE p.`item_id` = p_item_id
    AND p.`is_deleted` = 0
  GROUP BY p.`id`
  LIMIT 1;

  IF v_product_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Product does not exist.';
  END IF;

  IF v_available_quantity < p_quantity THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Not enough stock for the requested quantity.';
  END IF;

  START TRANSACTION;

  SET @line_order_id = p_order_id;
  SET @line_product_id = v_product_id;
  SET @line_quantity = p_quantity;
  SET @line_unit_price = v_unit_price;
  SET @line_item_name = (
    SELECT `name`
    FROM `products`
    WHERE `id` = v_product_id
    LIMIT 1
  );

  SET @sql_insert_item = '
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      item_snapshot_name
    ) VALUES (?, ?, ?, ?, ?)';

  PREPARE stmt_insert_item FROM @sql_insert_item;
  EXECUTE stmt_insert_item USING
    @line_order_id,
    @line_product_id,
    @line_quantity,
    @line_unit_price,
    @line_item_name;
  DEALLOCATE PREPARE stmt_insert_item;

  SELECT COALESCE(SUM(`quantity` * `unit_price`), 0.00)
  INTO v_subtotal
  FROM `order_items`
  WHERE `order_id` = p_order_id;

  SELECT `shipping_fee`
  INTO v_shipping_fee
  FROM `orders`
  WHERE `order_id` = p_order_id;

  UPDATE `orders`
  SET
    `subtotal` = v_subtotal,
    `vat_amount` = ROUND(v_subtotal * v_vat_rate, 2),
    `grand_total` = ROUND(v_subtotal + (v_subtotal * v_vat_rate) + v_shipping_fee, 2),
    `status` = 'To Ship'
  WHERE `order_id` = p_order_id;

  COMMIT;
END
SQL);

    $pdo->exec(<<<'SQL'
CREATE PROCEDURE `sp_record_payment`(
  IN p_order_id BIGINT,
  IN p_amount DECIMAL(10,2),
  IN p_method VARCHAR(50),
  IN p_status VARCHAR(50),
  IN p_reference_number VARCHAR(100)
)
BEGIN
  DECLARE order_exists INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT COUNT(*) INTO order_exists
  FROM `orders`
  WHERE `order_id` = p_order_id;

  IF order_exists = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Order does not exist.';
  END IF;

  START TRANSACTION;

  SET @payment_order_id = p_order_id;
  SET @payment_amount = p_amount;
  SET @payment_method = p_method;
  SET @payment_status = p_status;
  SET @payment_reference_number = p_reference_number;

  SET @sql_upsert_payment = '
    INSERT INTO payments (
      order_id,
      transaction_amount,
      payment_date,
      payment_status,
      reference_number,
      method
    ) VALUES (?, ?, NOW(), ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      transaction_amount = VALUES(transaction_amount),
      payment_date = VALUES(payment_date),
      payment_status = VALUES(payment_status),
      reference_number = VALUES(reference_number),
      method = VALUES(method)';

  PREPARE stmt_upsert_payment FROM @sql_upsert_payment;
  EXECUTE stmt_upsert_payment USING
    @payment_order_id,
    @payment_amount,
    @payment_status,
    @payment_reference_number,
    @payment_method;
  DEALLOCATE PREPARE stmt_upsert_payment;

  COMMIT;
END
SQL);

    echo "Order backend schema sync complete." . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'Sync failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}