## 1. Core Project Objective

The mandate requires the implementation of advanced database engineering, performance optimization, and transactional logic directly into an existing backend e-commerce database architecture.

---

## 2. Relational Database Schema & Architecture

### Required Table Specifications

* **Customers Table:** Must contain Customer ID (Primary Key), Name, Email, Phone Number, and transaction location or creation metadata.
* **Products Table:** Must contain Product ID (Primary Key), Product Name, Price, and current stock volumes.
* **Orders Table:** Must contain Order ID (Primary Key), Customer ID (Foreign Key), and chronological order timestamp.
* **Order Items Table:** Must contain Order Item ID (Primary Key), Order ID (Foreign Key), Product ID (Foreign Key), Quantity, and Unit Price.
* **Payments Table:** Must contain Payment ID (Primary Key), Order ID (Foreign Key), Transaction Amount, Payment Date, and current Payment Status.
* **Inventory Table:** This is a mandatory systemic modification that must actively track stock levels and automatically deduct item quantities whenever an order transaction completes.

### Entity Relational Matrix

| Entity Origin | Entity Destination | Cardinality | Functional Context |
| --- | --- | --- | --- |
| Customers | Orders | One-to-Many ($1:N$) | A unique customer can execute multiple orders. |
| Orders | Order Items | One-to-Many ($1:N$) | An individual order can contain multiple discrete products. |
| Products | Order Items | One-to-Many ($1:N$) | A single catalog product can exist across multiple order lists. |
| Orders | Payments | One-to-One ($1:1$) | Each unique order must resolve to exactly one payment record. |

---

## 3. Optimization & Programmability Requirements

### Performance Optimization

* **Indexing Architecture:** Implementation of a **minimum of five (5) distinct indices** across heavily queried search variables or foreign keys to prevent full-table scans as datasets grow.
* **Data Partitioning:** Implementation of a **minimum of three (3) horizontal partitions** to separate large datasets. These must be structurally isolated based on categorical fields such as operational branch location or chronological order dates.

### Transaction Management & Concurrency

* **Atomicity Implementation:** Multi-resource synchronization must explicitly use `START TRANSACTION`, `PREPARE`, and `COMMIT` primitives.
* **Concurrency Analysis:** Isolation and resolution of a **minimum of three (3) distinct failure scenarios** mapping systemic transaction drops (e.g., an order executing successfully while the payment gateway logs a write failure).

### Programmable Database Objects

* **Stored Procedures:** Development of a **minimum of three (3) functional stored procedures** natively executed inside the database engine to standardize systemic query modifications or administrative table scans.
* **Automated Triggers:** Development of a **minimum of three (3) automated database triggers** mapping table mutations. This must include `AFTER INSERT` routines for building independent data-audit logs and `BEFORE UPDATE` constraints to prevent properties (such as salary or inventory scales) from falling below zero.
* **UI Constraints:** Building a front-end User Interface for partitioning, triggers, and transactions is strictly optional; deep programmatic verification at the DBMS engine level is mandatory.

---

## 4. Timeline & Deliverables

### Administrative Milestones

* **Long Comprehensive Examination:** May 26, 2026. This evaluation covers all theoretical and practical concepts delivered throughout the academic term.
* **Final Project Presentation Defense:** May 29, 2026. The previous rolling schedule has been consolidated; all student groups must defend on this single date.
* **Grade Consultation Window:** June 1, 2026, to June 5, 2026. Final grade computation and physical consultation sessions occur during this period.

### Project Defense Deliverables

* **Structural PowerPoint Deck:** Must contain a technical schematic blueprint of the database architecture, table attributes, mapped relationships, and optimization criteria.
* **Live System Walkthrough:** A formal technical defense where students demonstrate code compliance and respond to direct queries regarding transactional logic and programmable database layers. Every presentation must be conducted in a formal, professional manner.