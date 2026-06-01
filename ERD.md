# ERD

This file shows the main database structure from the project brief in [CORE_PROJECT.MD](CORE_PROJECT.MD).

## Main ERD

```mermaid
erDiagram
    CUSTOMERS ||--o{ ORDERS : places
    ORDERS ||--|{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : appears_in
    ORDERS ||--|| PAYMENTS : has
    PRODUCTS ||--o{ INVENTORY : stocked_as
    PRODUCTS ||--|| PRODUCT_DETAILS : describes
    CATEGORIES ||--o{ PRODUCTS : groups
    PRODUCTS ||--o{ STOCK_AUDIT : logs

    CUSTOMERS {
        int id PK
        varchar email UK
        varchar username UK
        varchar name
        varchar contact_number
        varchar branch_location
        datetime registered_at
    }

    CATEGORIES {
        int id PK
        varchar category_name UK
        varchar category_group
        datetime created_at
    }

    PRODUCTS {
        int id PK
        varchar item_id UK
        varchar name
        int category_id FK
        varchar category_label
        varchar category_type
        datetime created_at
        tinyint is_deleted
    }

    PRODUCT_DETAILS {
        int id PK
        varchar item_id FK
        text description
        longtext specs_json
        varchar image_path
        text return_policy_text
        datetime updated_at
    }

    INVENTORY {
        int id PK
        int product_id FK
        decimal unit_price
        int quantity_on_hand
        varchar branch_location
        varchar size_label
        datetime date_created
        datetime date_updated
        tinyint is_deleted
    }

    ORDERS {
        bigint order_id PK
        int customer_id FK
        datetime order_date
        varchar status
        decimal subtotal
        decimal vat_amount
        decimal shipping_fee
        decimal grand_total
        varchar payment_method
        varchar contact_number
        varchar shipping_address
        varchar branch_location
        varchar placed_by
    }

    ORDER_ITEMS {
        bigint id PK
        bigint order_id FK
        int product_id FK
        int quantity
        decimal unit_price
        varchar item_snapshot_name
    }

    PAYMENTS {
        bigint payment_id PK
        bigint order_id FK, UK
        decimal transaction_amount
        datetime payment_date
        varchar payment_status
        varchar reference_number
        varchar method
    }

    STOCK_AUDIT {
        bigint audit_id PK
        varchar item_id
        varchar action_type
        datetime action_date PK
        int quantity_before
        int quantity_after
        varchar notes
    }
```

## Notes

- `orders -> payments` is one-to-one because `payments.order_id` is unique.
- Price and stock are stored in `inventory` to avoid duplicated values in `products`.
- `stock_audit` is partitioned by date.