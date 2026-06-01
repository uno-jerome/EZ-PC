USE `itc_database_admin`;

-- ============================================================
-- SIMPLE PRESENTATION SQL
-- Run one section at a time.
-- ============================================================

-- SECTION 1: Core tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN (
    'customers',
    'products',
    'inventory',
    'orders',
    'order_items',
    'payments',
    'stock_audit'
  )
ORDER BY table_name;

-- SECTION 2: Required columns
SELECT table_name, column_name, column_type, is_nullable, column_key, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN (
    'customers',
    'products',
    'inventory',
    'orders',
    'order_items',
    'payments'
  )
ORDER BY table_name, ordinal_position;

-- SECTION 3: Indexes
SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN (
    'customers',
    'products',
    'inventory',
    'orders',
    'order_items',
    'payments',
    'stock_audit'
  )
ORDER BY table_name, index_name, seq_in_index;

-- SECTION 4: Partitions
SELECT table_name, partition_name, partition_method, partition_description
FROM information_schema.partitions
WHERE table_schema = DATABASE()
  AND table_name = 'stock_audit'
ORDER BY partition_ordinal_position;

-- SECTION 5: Procedures
SELECT routine_name, routine_type, created, last_altered
FROM information_schema.routines
WHERE routine_schema = DATABASE()
  AND routine_type = 'PROCEDURE'
ORDER BY routine_name;

-- SECTION 6: Triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = DATABASE()
ORDER BY event_object_table, trigger_name;

-- SECTION 7: Inventory audit rows with real before/after values
SELECT audit_id, item_id, action_type, action_date, quantity_before, quantity_after, notes
FROM stock_audit
WHERE quantity_before IS NOT NULL
   OR quantity_after IS NOT NULL
ORDER BY action_date DESC
LIMIT 10;

-- SECTION 8: One-to-one proof for payments and orders
SELECT table_name, index_name, column_name, non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'payments'
  AND index_name = 'ux_payments_order_id';

-- SECTION 9: Safe rollback demo
START TRANSACTION;
SELECT 'Transaction started. This is only a demo.' AS message;
ROLLBACK;
SELECT 'Rollback executed. No permanent change was saved.' AS message;

-- SECTION 10: Optional object definitions
SHOW CREATE TABLE `orders`;
SHOW CREATE TABLE `payments`;
SHOW CREATE TABLE `stock_audit`;
SHOW CREATE PROCEDURE `sp_create_order_header`;
SHOW CREATE PROCEDURE `sp_add_order_item`;
SHOW CREATE PROCEDURE `sp_record_payment`;