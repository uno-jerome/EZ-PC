# Estore (School E-commerce Project)

This repository contains a simple e-commerce website + PHP API, plus the database schema and presentation artifacts for the ITC database requirements.

## Quick Start (Windows)

1) Create / rebuild the database schema (MariaDB/MySQL):

- Run the schema file: [item_database_structure_new.sql](item_database_structure_new.sql)
- Or (optional) use the rebuild helper:
  - `php scripts/rebuild_db.php`

2) Start the website + API:

- Run: [start-server.cmd](start-server.cmd)
- Open: http://127.0.0.1:8000

Manual start (any OS):

```bash
php -S 127.0.0.1:8000 -t .
```

## Where Things Are

- Website + API (web root): this repository root
  - Website entry: [index.html](index.html)
  - API endpoints: [api/](api/)
- Database schema (canonical): [item_database_structure_new.sql](item_database_structure_new.sql)
- Presentation artifacts:
  - [PRESENTATION.md](PRESENTATION.md)
  - [PRESENTATION.sql](PRESENTATION.sql)
  - [ERD.md](ERD.md)
- Admin/demo scripts:
  - [scripts/](scripts/)

## API Endpoints

- Products (public): [/api/products.php](api/products.php)
- Auth (signup/login): [/api/auth.php](api/auth.php)
- Orders (create/list): [/api/orders.php](api/orders.php)

## Configuration (DB Credentials)

The PHP API reads credentials from environment variables:

- `DB_HOST` (default: 127.0.0.1)
- `DB_PORT` (default: 3306)
- `DB_NAME` (default: itc_database_admin)
- `DB_USER` (default: root)
- `DB_PASSWORD` (default: root)

Tip: Don’t commit real passwords. The API reads environment variables directly. On Windows PowerShell you can set them like:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'root'
```
