# Estore

Hi! This is our school e-commerce project.

It has a simple frontend, a PHP backend API, and a MySQL/MariaDB database.

## Quick Run

### 1) Set up the database first

Run [item_database_structure_new.sql](item_database_structure_new.sql) in your MySQL/MariaDB server.

This is the recommended default because it gives you a clean and consistent setup.

Optional (for quick demo data):
- Run [archive/item_database_latest.sql](archive/item_database_latest.sql)
- Use this when you want preloaded sample records right away.

If you want a helper script instead:

```bash
php scripts/rebuild_db.php
```

### 2) Start the website + API

Easiest on Windows:
- Run [start-server.cmd](start-server.cmd)

Manual way (any OS):

```bash
php -S 127.0.0.1:8000 -t .
```

Open this in your browser:
- http://127.0.0.1:8000

## Main Files

- Entry page: [index.html](index.html)
- API: [api/](api/)
- Frontend JS: [js/](js/)
- Styles: [style.css](style.css)
- DB schema: [item_database_structure_new.sql](item_database_structure_new.sql)
- Full dump with structure + sample data: [archive/item_database_latest.sql](archive/item_database_latest.sql)
- Presentation docs: [PRESENTATION.md](PRESENTATION.md), [PRESENTATION.sql](PRESENTATION.sql), [ERD.md](ERD.md)
- Utility/admin scripts: [scripts/](scripts/)

## API Endpoints

- Products: [api/products.php](api/products.php)
- Auth (signup/login): [api/auth.php](api/auth.php)
- Orders: [api/orders.php](api/orders.php)

## DB Environment Variables

The API checks these values:

- DB_HOST (default: 127.0.0.1)
- DB_PORT (default: 3306)
- DB_NAME (default: itc_database_admin)
- DB_USER (default: root)
- DB_PASSWORD (default: root)

PowerShell example:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'root'
```

## Quick Troubleshooting

- `could not find driver`: enable `pdo_mysql` in your PHP setup.
- DB connection error: check your DB credentials and make sure MySQL/MariaDB is running.

## Note

Please do not commit real passwords or private credentials.
