# Presentation Guide

This is the simple file to use for the project presentation.

## Use These Files Only

- [ERD.md](ERD.md)
- [PRESENTATION.sql](PRESENTATION.sql)
- [CORE_PROJECT.MD](CORE_PROJECT.MD)

## Final Schema File

- final schema file: [item_database_structure_new.sql](item_database_structure_new.sql)
- this is the schema file used by [scripts/rebuild_db.php](scripts/rebuild_db.php)
- [archive/legacy_itc_database_structure_.sql](archive/legacy_itc_database_structure_.sql) is the archived old fallback copy
- [archive/legacy_itc_database_structure_new.sql](archive/legacy_itc_database_structure_new.sql) is an archived old copy and is not the file currently used by the rebuild script

## Current Status Against The Core Project

Mostly complete.

Already implemented in the live database:

- required core tables
- more than 5 indexes
- 3 table partitions on `stock_audit`
- 3 stored procedures
- more than 3 triggers
- transaction logic using `START TRANSACTION`, `PREPARE`, `COMMIT`, and rollback handlers

One important note:

- `products` does not directly store price and stock
- price and stock are normalized into `inventory`
- explain this in the presentation as a design choice to avoid duplicated data

## Simple Difference In The Old SQL Files

The old files were overlapping:

- one was more like a speaking flow
- one was more like a checklist

Now they are merged into one file: [PRESENTATION.sql](PRESENTATION.sql)

## Concurrency And Transaction Notes

### 1. Order Header Created But Item Insert Fails

- the order starts
- adding the item fails because stock is not enough
- rollback prevents half-saved order data

Simple line:

"If adding the item fails, the transaction rolls back so the order is not saved halfway."

### 2. Payment Write Starts But Fails Before Commit

- the system starts saving payment data
- an SQL error happens before commit
- rollback keeps order and payment data consistent

Simple line:

"If the payment save fails, rollback keeps the database consistent."

### 3. Two Buyers Try To Buy The Last Unit

- two users try to buy the same final stock
- inventory rules prevent invalid negative stock
- invalid update should fail instead of silently saving bad data

Simple line:

"If two buyers race for the last stock, the system should reject invalid stock deductions."

## Audit Trail Note

- `order_item_added` audit rows can have `quantity_before` and `quantity_after` as `NULL`
- that is because they log item addition, not actual inventory movement
- actual inventory changes are shown by `inventory_updated` rows

## Simple PPT Outline

### Slide 1: Title

- `[PLACE PROJECT TITLE HERE]`
- `[PLACE MEMBER NAMES HERE]`
- `[PLACE SUBJECT HERE]`

### Slide 2: Project Objective

- `[PLACE SIMPLE SYSTEM DESCRIPTION HERE]`
- `[PLACE DATABASE GOAL HERE]`

### Slide 3: Required Tables

- Customers
- Products
- Inventory
- Orders
- Order Items
- Payments
- Stock Audit

### Slide 4: ERD

- use [ERD.md](ERD.md)
- `[PLACE ERD IMAGE HERE]`

### Slide 5: Relationships

- one customer can have many orders
- one order can have many items
- one product can appear in many order items
- one order has one payment

### Slide 6: Indexing And Partitioning

- indexes help searching become faster
- `stock_audit` has 3 partitions
- `[PLACE INDEX LIST OR SCREENSHOT HERE]`

### Slide 7: Procedures And Triggers

- `sp_create_order_header`
- `sp_add_order_item`
- `sp_record_payment`
- `trg_inventory_before_update_non_negative`
- `trg_inventory_after_update_audit`
- `trg_payments_after_insert_deduct_inventory`

### Slide 8: Transactions And Concurrency

- `START TRANSACTION`
- `PREPARE`
- `COMMIT`
- `ROLLBACK`
- the 3 failure scenarios above

### Slide 9: Live SQL Proof

- use [PRESENTATION.sql](PRESENTATION.sql)
- `[PLACE SQLyog OUTPUT OR SCREENSHOT HERE]`

### Slide 10: Conclusion

- `[PLACE SIMPLE CONCLUSION HERE]`

## Keep It Simple

- use short text only
- prefer screenshots for proof
- explain extra details while speaking, not by filling the slide with text