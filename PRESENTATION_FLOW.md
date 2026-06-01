# Presentation Flow

## Slide 1: Title
- Introduce the project as a simple school e-commerce store built with HTML, CSS, JavaScript, PHP, and MySQL/MariaDB.
- Say who worked on it and what the system is meant to show: a working online shopping flow.

## Slide 2: What the Project Does
- Explain that customers can browse products, add items to a cart, sign up or log in, and complete checkout.
- Mention that the app also shows purchase history and allows order cancellation when allowed.

## Slide 3: System Architecture
- Describe the frontend as static pages with JavaScript modules for UI and API calls.
- Describe the backend as a PHP API using PDO to talk to MySQL/MariaDB.

## Slide 4: Database Design
- Explain the main tables: customers, products, inventory, orders, order items, payments, and stock audit.
- Say why inventory is separate from products: it keeps price and stock normalized and avoids duplicating data.

## Slide 5: Checkout and VAT
- Explain that stored prices are VAT-inclusive in the database.
- Emphasize the frontend reverses the VAT rate for display only, so the app does not persist a separate VAT rate in the schema.

## Slide 6: Security and Reliability
- Mention the login/signup API uses `password_hash()` and `password_verify()` for secure password storage.
- Note the backend includes safer input handling and JSON validation for API requests.

## Slide 7: Demo Script
- Show product browsing, add-to-cart, signup/login, checkout, and purchase history in one flow.
- Point out the cancel button is disabled when an order cannot be canceled.

## Slide 8: Why This Project Works
- Summarize that it is a complete student e-commerce proof of concept with a working frontend, API, and relational database.
- Add that extra cleanup was applied by removing unused helper scripts and keeping only the files needed for the demo.

## Slide 9: Closing
- Finish with a short conclusion: the app demonstrates a full shopping flow, data consistency, and safe user authentication.
- Invite questions about the database design, checkout flow, or the PHP/JavaScript integration.