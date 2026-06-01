/*
SQLyog Ultimate v12.4.1 (64 bit)
MySQL - 10.3.17-MariaDB : Database - itc_database_admin
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`itc_database_admin` /*!40100 DEFAULT CHARACTER SET utf8 */;

USE `itc_database_admin`;

/*Table structure for table `categories` */

DROP TABLE IF EXISTS `categories`;

CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(120) NOT NULL,
  `category_group` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_categories_name` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4;

/*Table structure for table `customers` */

DROP TABLE IF EXISTS `customers`;

CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `contact_number` varchar(50) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `branch_location` varchar(100) DEFAULT 'Online',
  `registered_at` datetime NOT NULL DEFAULT current_timestamp(),
  `failed_login_count` int(11) NOT NULL DEFAULT 0,
  `last_failed_login` datetime DEFAULT NULL,
  `account_locked` tinyint(1) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_customers_email` (`email`),
  UNIQUE KEY `ux_customers_username` (`username`),
  KEY `idx_customers_registered_at` (`registered_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4;

/*Table structure for table `inventory` */

DROP TABLE IF EXISTS `inventory`;

CREATE TABLE `inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `quantity_on_hand` int(11) NOT NULL DEFAULT 0,
  `branch_location` varchar(100) NOT NULL DEFAULT 'Main Warehouse',
  `size_label` varchar(50) DEFAULT NULL,
  `date_created` datetime NOT NULL DEFAULT current_timestamp(),
  `date_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_inventory_product_branch` (`product_id`,`branch_location`),
  KEY `idx_inventory_branch_product` (`branch_location`,`product_id`),
  CONSTRAINT `fk_inventory_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3889 DEFAULT CHARSET=utf8mb4;

/*Table structure for table `order_items` */

DROP TABLE IF EXISTS `order_items`;

CREATE TABLE `order_items` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `item_snapshot_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Table structure for table `orders` */

DROP TABLE IF EXISTS `orders`;

CREATE TABLE `orders` (
  `order_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `order_date` datetime NOT NULL DEFAULT current_timestamp(),
  `status` varchar(50) NOT NULL DEFAULT 'To Ship',
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `shipping_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payment_method` varchar(50) NOT NULL DEFAULT 'Cash',
  `contact_number` varchar(50) DEFAULT NULL,
  `shipping_address` varchar(255) DEFAULT NULL,
  `branch_location` varchar(100) NOT NULL DEFAULT 'Main Warehouse',
  `placed_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_orders_customer_date` (`customer_id`,`order_date`),
  KEY `idx_orders_status_date` (`status`,`order_date`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Table structure for table `payments` */

DROP TABLE IF EXISTS `payments`;

CREATE TABLE `payments` (
  `payment_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) NOT NULL,
  `transaction_amount` decimal(10,2) NOT NULL,
  `payment_date` datetime NOT NULL DEFAULT current_timestamp(),
  `payment_status` varchar(50) NOT NULL DEFAULT 'Pending',
  `reference_number` varchar(100) DEFAULT NULL,
  `method` varchar(50) NOT NULL DEFAULT 'Cash',
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `ux_payments_order_id` (`order_id`),
  KEY `idx_payments_status_date` (`payment_status`,`payment_date`),
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*Table structure for table `product_details` */

DROP TABLE IF EXISTS `product_details`;

CREATE TABLE `product_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `specs_json` longtext DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `return_policy_text` text DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_product_details_item_id` (`item_id`),
  CONSTRAINT `fk_product_details_item_id` FOREIGN KEY (`item_id`) REFERENCES `products` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3889 DEFAULT CHARSET=utf8mb4;

/*Table structure for table `products` */

DROP TABLE IF EXISTS `products`;

CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `category_label` varchar(120) DEFAULT NULL,
  `category_type` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_products_item_id` (`item_id`),
  KEY `idx_products_category_name` (`category_id`,`name`),
  KEY `idx_products_label_name` (`category_label`,`name`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3889 DEFAULT CHARSET=utf8mb4;

/*Table structure for table `stock_audit` */

DROP TABLE IF EXISTS `stock_audit`;

CREATE TABLE `stock_audit` (
  `audit_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `action_date` datetime NOT NULL DEFAULT current_timestamp(),
  `quantity_before` int(11) DEFAULT NULL,
  `quantity_after` int(11) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`audit_id`,`action_date`),
  KEY `idx_stock_audit_item_date` (`item_id`,`action_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
 PARTITION BY RANGE  COLUMNS(`action_date`)
(PARTITION `p_before_2026` VALUES LESS THAN ('2026-01-01 00:00:00') ENGINE = InnoDB,
 PARTITION `p_2026` VALUES LESS THAN ('2027-01-01 00:00:00') ENGINE = InnoDB,
 PARTITION `p_2027_and_future` VALUES LESS THAN (MAXVALUE) ENGINE = InnoDB);

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'admin',
  `failed_login_count` int(11) NOT NULL DEFAULT 0,
  `last_failed_login` datetime DEFAULT NULL,
  `account_locked` tinyint(1) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Trigger structure for table `inventory` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_inventory_before_update_non_negative` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_inventory_before_update_non_negative` BEFORE UPDATE ON `inventory` FOR EACH ROW 
BEGIN
  IF NEW.`quantity_on_hand` < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Inventory quantity cannot be negative.';
  END IF;

  IF NEW.`unit_price` < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Inventory unit price cannot be negative.';
  END IF;
END */$$


DELIMITER ;

/* Trigger structure for table `inventory` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_inventory_after_update_audit` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_inventory_after_update_audit` AFTER UPDATE ON `inventory` FOR EACH ROW 
BEGIN
  IF OLD.`quantity_on_hand` <> NEW.`quantity_on_hand` THEN
    INSERT INTO `stock_audit` (
      `item_id`,
      `action_type`,
      `action_date`,
      `quantity_before`,
      `quantity_after`,
      `notes`
    )
    SELECT
      p.`item_id`,
      'inventory_updated',
      NOW(),
      OLD.`quantity_on_hand`,
      NEW.`quantity_on_hand`,
      CONCAT('Inventory changed at branch ', NEW.`branch_location`, ' by ', NEW.`quantity_on_hand` - OLD.`quantity_on_hand`)
    FROM `products` p
    WHERE p.`id` = NEW.`product_id`;
  END IF;
END */$$


DELIMITER ;

/* Trigger structure for table `order_items` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_order_items_after_insert_audit` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_order_items_after_insert_audit` AFTER INSERT ON `order_items` FOR EACH ROW 
BEGIN
  INSERT INTO `stock_audit` (
    `item_id`,
    `action_type`,
    `action_date`,
    `quantity_before`,
    `quantity_after`,
    `notes`
  )
  SELECT
    p.`item_id`,
    'order_item_added',
    NOW(),
    NULL,
    NULL,
    CONCAT('Order ', NEW.`order_id`, ' item added with quantity ', NEW.`quantity`)
  FROM `products` p
  WHERE p.`id` = NEW.`product_id`;
END */$$


DELIMITER ;

/* Trigger structure for table `payments` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_payments_after_insert_deduct_inventory` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_payments_after_insert_deduct_inventory` AFTER INSERT ON `payments` FOR EACH ROW 
BEGIN
  IF NEW.`payment_status` = 'Paid' THEN
    UPDATE `inventory` i
    INNER JOIN `orders` o ON o.`order_id` = NEW.`order_id`
    INNER JOIN `order_items` oi ON oi.`product_id` = i.`product_id`
    SET i.`quantity_on_hand` = i.`quantity_on_hand` - oi.`quantity`
    WHERE oi.`order_id` = NEW.`order_id`
      AND i.`branch_location` = o.`branch_location`
      AND i.`is_deleted` = 0;

    UPDATE `orders`
    SET `status` = 'To Ship'
    WHERE `order_id` = NEW.`order_id`
      AND `status` = 'To Pay';
  END IF;
END */$$


DELIMITER ;

/* Trigger structure for table `payments` */

DELIMITER $$

/*!50003 DROP TRIGGER*//*!50032 IF EXISTS */ /*!50003 `trg_payments_after_update_deduct_inventory` */$$

/*!50003 CREATE */ /*!50017 DEFINER = 'root'@'localhost' */ /*!50003 TRIGGER `trg_payments_after_update_deduct_inventory` AFTER UPDATE ON `payments` FOR EACH ROW 
BEGIN
  IF NEW.`payment_status` = 'Paid' AND OLD.`payment_status` <> 'Paid' THEN
    UPDATE `inventory` i
    INNER JOIN `orders` o ON o.`order_id` = NEW.`order_id`
    INNER JOIN `order_items` oi ON oi.`product_id` = i.`product_id`
    SET i.`quantity_on_hand` = i.`quantity_on_hand` - oi.`quantity`
    WHERE oi.`order_id` = NEW.`order_id`
      AND i.`branch_location` = o.`branch_location`
      AND i.`is_deleted` = 0;

    UPDATE `orders`
    SET `status` = 'To Ship'
    WHERE `order_id` = NEW.`order_id`
      AND `status` = 'To Pay';
  END IF;
END */$$


DELIMITER ;

/* Procedure structure for procedure `sp_add_order_item` */

/*!50003 DROP PROCEDURE IF EXISTS  `sp_add_order_item` */;

DELIMITER $$

/*!50003 CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_add_order_item`(
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
    `grand_total` = ROUND(v_subtotal + (v_subtotal * v_vat_rate) + v_shipping_fee, 2)
  WHERE `order_id` = p_order_id;

  COMMIT;
END */$$
DELIMITER ;

/* Procedure structure for procedure `sp_create_order_header` */

/*!50003 DROP PROCEDURE IF EXISTS  `sp_create_order_header` */;

DELIMITER $$

/*!50003 CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_create_order_header`(
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
END */$$
DELIMITER ;

/* Procedure structure for procedure `sp_record_payment` */

/*!50003 DROP PROCEDURE IF EXISTS  `sp_record_payment` */;

DELIMITER $$

/*!50003 CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_record_payment`(
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
END */$$
DELIMITER ;

/*Table structure for table `stocks` */

DROP TABLE IF EXISTS `stocks`;

/*!50001 DROP VIEW IF EXISTS `stocks` */;
/*!50001 DROP TABLE IF EXISTS `stocks` */;

/*!50001 CREATE TABLE  `stocks`(
 `id` int(11) ,
 `item_id` varchar(50) ,
 `name` varchar(255) ,
 `price` decimal(10,2) ,
 `quantity` decimal(32,0) ,
 `category` varchar(120) ,
 `date` datetime ,
 `is_deleted` tinyint(1) ,
 `category_type` varchar(120) 
)*/;

/*Table structure for table `vw_salesreport` */

DROP TABLE IF EXISTS `vw_salesreport`;

/*!50001 DROP VIEW IF EXISTS `vw_salesreport` */;
/*!50001 DROP TABLE IF EXISTS `vw_salesreport` */;

/*!50001 CREATE TABLE  `vw_salesreport`(
 `ProductName` varchar(255) ,
 `Quantity` decimal(32,0) ,
 `SaleDate` date ,
 `TotalSale` decimal(42,2) 
)*/;

/*View structure for view stocks */

/*!50001 DROP TABLE IF EXISTS `stocks` */;
/*!50001 DROP VIEW IF EXISTS `stocks` */;

/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `stocks` AS select `p`.`id` AS `id`,`p`.`item_id` AS `item_id`,`p`.`name` AS `name`,cast(coalesce(max(`i`.`unit_price`),0.00) as decimal(10,2)) AS `price`,coalesce(sum(case when `i`.`is_deleted` = 0 then `i`.`quantity_on_hand` else 0 end),0) AS `quantity`,coalesce(`c`.`category_name`,`p`.`category_label`,'Uncategorized') AS `category`,`p`.`created_at` AS `date`,`p`.`is_deleted` AS `is_deleted`,coalesce(`p`.`category_type`,`c`.`category_group`,'') AS `category_type` from ((`products` `p` left join `categories` `c` on(`c`.`id` = `p`.`category_id`)) left join `inventory` `i` on(`i`.`product_id` = `p`.`id`)) group by `p`.`id`,`p`.`item_id`,`p`.`name`,`c`.`category_name`,`p`.`category_label`,`p`.`created_at`,`p`.`is_deleted`,`p`.`category_type`,`c`.`category_group` */;

/*View structure for view vw_salesreport */

/*!50001 DROP TABLE IF EXISTS `vw_salesreport` */;
/*!50001 DROP VIEW IF EXISTS `vw_salesreport` */;

/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_salesreport` AS select `p`.`name` AS `ProductName`,sum(`oi`.`quantity`) AS `Quantity`,cast(`o`.`order_date` as date) AS `SaleDate`,sum(`oi`.`quantity` * `oi`.`unit_price`) AS `TotalSale` from (((`order_items` `oi` join `orders` `o` on(`o`.`order_id` = `oi`.`order_id`)) join `products` `p` on(`p`.`id` = `oi`.`product_id`)) left join `payments` `pay` on(`pay`.`order_id` = `o`.`order_id`)) where `pay`.`payment_status` = 'Paid' or `o`.`status` in ('To Ship','To Receive','Completed') group by `p`.`name`,cast(`o`.`order_date` as date) */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
