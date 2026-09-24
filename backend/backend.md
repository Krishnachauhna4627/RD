# RD Enterprises — Backend

REST API for the RD Enterprises site. Express 5 + TypeScript, MySQL 8 via raw SQL.

The first slice covers authentication: the login dialog in the site header signs in
against the `users` table and gets back a token.

---

## 1. Prerequisites

| Need | Version | Check |
|---|---|---|
| Node.js | >= 22.22.3 (24 recommended) | `node -v` |
| MySQL | 8.x, running | `systemctl is-active mysql` |

> **The system `node` on this machine is v12, which is far too old.** Use nvm before
> running anything here:
>
> ```bash
> nvm use            # reads .nvmrc -> 24
> # or, without nvm:
> export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
> ```
>
> Symptom if you forget: `SyntaxError: Unexpected token '?'` or the Angular CLI
> refusing to start.

---

## 2. Setup, start to finish

```bash
cd backend

# 1. Dependencies
npm install

# 2. Create the database and the app's MySQL user (needs root — once only)
#    SKIP THIS if you already have a MySQL user and the rd_collections database;
#    just put your own credentials in .env instead.
sudo mysql < setup-database.sql

# 3. Create the tables
npm run db:migrate

# 4. Create an account to log in with
npm run db:seed          # admin / admin123

# 5. Run it
npm run dev              # http://localhost:3000
```

Confirm it worked:

```bash
npm run db:check
curl http://localhost:3000/api/health
```

---

## 3. Configuration

All settings live in `backend/.env`. That file is **gitignored** — it holds the real
password. `.env.example` is the committed template; add every new key to both.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `NODE_ENV` | `development` | `production` hides error details from responses |
| `CORS_ORIGIN` | `http://localhost:4200` | Angular dev server allowed to call the API |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `rd_collections` | Database name |
| `DB_USER` | `rd_app` | MySQL user the API connects as (currently `nav` locally) |
| `DB_PASSWORD` | *(generated)* | That user's password |
| `JWT_SECRET` | *(generated)* | Signs login tokens — changing it logs everyone out |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime |

`.env` is read by `src/config/env.ts` using Node's built-in `process.loadEnvFile()`,
so there is no `dotenv` dependency and no `--env-file` flag to remember. Every
required value is checked at startup: a missing one throws a named error instead of
surfacing later as a confusing MySQL failure.

---

## 4. The database connection

**There is exactly one connection setup in this codebase: `src/db/pool.ts`.**
Nothing else calls `mysql.createPool` or `mysql.createConnection`. Everything that
touches the database imports from that file:

```ts
import { query, queryOne, execute, transaction } from '../db/pool.js';
```

It connects once. An ES module is evaluated a single time per process no matter how
many files import it, so every importer shares the same instance — importing it from
ten files does not open ten connections.

It is a **pool** rather than a single connection deliberately. One raw connection can
only run one query at a time, and if the network drops it stays dead. A pool keeps a
small set of reusable connections (10 here), lends one out per query, takes it back
when the query finishes, and reconnects on its own. Callers never open or close
anything.

### What it gives you

| Function | Use for |
|---|---|
| `query<T>(sql, params)` | SELECT returning many rows |
| `queryOne<T>(sql, params)` | SELECT returning one row or `null` |
| `execute(sql, params)` | INSERT / UPDATE / DELETE — returns `insertId`, `affectedRows` |
| `transaction(fn)` | Several writes that must all succeed or all roll back |
| `pool` | The raw pool, for anything the helpers do not cover |

```ts
import { query, queryOne, execute } from '../db/pool.js';

const all     = await query<ProductRow>('SELECT * FROM products WHERE active = ?', [1]);
const one     = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [7]);
const created = await execute('INSERT INTO products (name) VALUES (?)', ['Cups']);
console.log(created.insertId);
```

> **Always pass values as `?` parameters, never by building the SQL string.**
> The `?` placeholders are sent to MySQL separately from the query, so a value can
> never be read as SQL. String concatenation is how SQL injection happens.

Transactions get their own connection for the duration, and commit, roll back and
release it for you:

```ts
await transaction(async (conn) => {
  await conn.execute('INSERT INTO orders (user_id) VALUES (?)', [userId]);
  await conn.execute('UPDATE stock SET qty = qty - 1 WHERE id = ?', [itemId]);
});
```

---

## 5. Project layout

```
backend/
  backend.md              this file
  .env                    real settings — gitignored
  .env.example            committed template
  setup-database.sql      one-time root setup — gitignored, holds the password
  sql/
    001_create_users.sql  schema, applied in filename order
  src/
    index.ts              entry point: verify DB, listen, shut down cleanly
    app.ts                builds the Express app (separate so tests can import it)
    config/env.ts         reads and validates .env once
    db/
      pool.ts             THE database connection — import this everywhere
      migrate.ts          applies sql/*.sql once each
      seed.ts             creates a starter admin account
      check.ts            prints connection status and tables
    routes/auth.ts        POST /api/auth/login, GET /api/auth/me
    services/
      users.ts            all SQL touching the users table
      tokens.ts           signing and verifying tokens
    middleware/
      auth.ts             requireAuth — checks the Bearer token
      error.ts            ApiError + the single error handler
```

The layering is: **routes** validate input and shape responses, **services** own the
SQL, **db/pool.ts** owns the connection. Routes do not write SQL.

---

## 6. Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED | PK, auto-increment |
| `username` | VARCHAR(64) | unique |
| `password_hash` | VARCHAR(255) | bcrypt, 12 rounds — never the plain password |
| `role` | VARCHAR(32) | `user` (default) or `admin` |
| `is_active` | TINYINT(1) | `0` blocks sign-in without deleting the row |
| `created_at` | TIMESTAMP | set on insert |
| `updated_at` | TIMESTAMP | updated automatically |

### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | INT UNSIGNED | PK, auto-increment |
| `name` | VARCHAR(160) | |
| `category` | VARCHAR(80) | free text, indexed |
| `material_type` | VARCHAR(48) | one of the fixed list, indexed |
| `quantity_unit` | VARCHAR(24) | one of the fixed unit list, default `Piece` |
| `created_at` / `updated_at` | TIMESTAMP | |

Unique on **(`name`, `material_type`)** rather than name alone, so a paper cup and a
plastic cup of the same name can both exist.

### `purchases` / `purchase_items`

One purchase is one bill: `purchase_date` (DATE), `total_amount` (DECIMAL 12,2) and
`created_by` (user, nullable). Each line in `purchase_items` holds `product_id`,
`quantity` (DECIMAL 12,3, so weights like 2.5 Kg work), `quantity_unit` (copied from
the product at purchase time), `unit_price` and `line_total`.

Deleting a purchase deletes its lines. A product with purchase lines **cannot be
deleted** (FK `RESTRICT`), and the API answers 409 instead.

### `customers`

`customer_name`, `is_regular` (true/false) and `phone` are required. `contact_person`, `email`, `city`,
`address` and `gstin` are optional, and stored as NULL when left empty. `phone` is
stored digits-only with an optional leading `+`, and is **unique**, so the same
shop cannot be added twice. Note that `9876543210` and `+919876543210` count as
different numbers.

`is_active` (default true) marks whether the customer still orders. Deactivating
keeps the record; it is changed only through the status endpoint, never by `PUT`.

### `customer_rates`

The price agreed with a customer for a product, per the product's quantity unit.
Primary key **(`customer_id`, `product_id`)**, so one rate per product per customer.
`rate` is DECIMAL(12,2). A product with no row simply has no rate for that
customer. Rows are deleted along with their customer or product (`CASCADE`).

### `sales` / `sale_items`

Same shape as purchases, plus `customer_id` (required, `RESTRICT`, so a customer with
sales cannot be deleted). Each line copies the product's unit at sale time.

### Adding a migration

Drop a new file in `sql/` with the next number prefix (`002_create_products.sql`) and
run `npm run db:migrate`. Applied filenames are recorded in `schema_migrations`, so
re-running skips them. **Never edit a migration that has already been applied** — it
will not run again. Write a new one that alters the table instead.

---

## 7. API

Base URL `http://localhost:3000`. Bodies and responses are JSON.

### `GET /api/health`

```json
{ "status": "ok", "database": "connected" }
```
`503` with `"status": "degraded"` if MySQL is unreachable.

### `POST /api/auth/login`

```json
{ "username": "admin", "password": "admin123" }
```

**200**
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

**400** — missing or malformed field: `{ "error": "Username is required" }`
**401** — `{ "error": "Invalid username or password" }`

The 401 is deliberately identical whether the username does not exist, the password
is wrong, or the account is deactivated. Distinguishing them would let anyone test
which usernames are real. For the same reason a bcrypt comparison is run even when
the user does not exist, so an unknown username does not answer measurably faster.

### `GET /api/products`

Requires `Authorization: Bearer <token>`. Returns the whole catalogue, sorted by name.

```json
{ "products": [
  { "id": 1, "name": "Kraft Food Box 750ml", "category": "Food Containers",
    "material_type": "Paper", "quantity_unit": "Piece", "created_at": "...", "updated_at": "..." }
] }
```

### `POST /api/products`

Requires a token.

```json
{ "name": "Kraft Food Box 750ml", "category": "Food Containers", "materialType": "Paper",
  "quantityUnit": "Piece" }
```

**201** `{ "product": { ... } }`
**400** — missing field, or a `materialType` / `quantityUnit` not on the list
**409** — that name already exists in that material
**401** — no or bad token

`materialType` must be one of: `Thermocol`, `Plastic`, `Paper`, `Bagasse`, `Aluminium`,
`Wood`, `Cornstarch`, `Other`. The list lives in `src/services/products.ts` and is
mirrored in `frontend/src/app/core/products/product.models.ts` — **change both**, or
the dropdown will offer a value the API rejects.

`quantityUnit` must be one of: `Piece`, `Packet`, `Box`, `Dozen`, `Kg`, `Gram`, `Roll`,
`Bundle` — same rule: the list is in both files, change both.

`category` is free text with suggestions in the UI, so new ranges do not need a
code change.

### `GET /api/products/materials`

The allowed material list, for building a dropdown without hardcoding it.

### `GET /api/products/units`

The allowed quantity units.

### `DELETE /api/products/:id`

Requires a token. **204** on success, **404** if it does not exist.
**409** if the product has purchases recorded against it.
*No UI calls this yet — the dashboard table is currently read-and-add only.*

### `GET /api/purchases`

Requires a token. Every purchase, newest date first, each with its `items`
(product name, material and category joined in).

### `POST /api/purchases`

Requires a token.

```json
{ "purchaseDate": "2026-09-23",
  "items": [ { "productId": 8, "quantity": 100, "unitPrice": 1.25 } ] }
```

**201** `{ "purchase": { ..., "items": [ ... ] } }`
**400** — bad date, no items, quantity ≤ 0, negative price, or an unknown product

Line and bill totals are computed on the server, rounded to 2 decimals. Totals
sent by the client are ignored.

### `GET /api/purchases/stock`

Requires a token. Stock on hand per product (and unit): `purchased`, `sold`,
`quantity` (purchased − sold), `total_spent`, `last_purchased` and `last_sold`.
`quantity` can go negative if a sale was entered before its purchase. The API allows
that on purpose, and the dashboard warns instead of blocking the sale.

### `GET /api/auth/me`

Requires `Authorization: Bearer <token>`. Confirms a token is still valid.

**200** `{ "user": { "id": 1, "username": "admin", "role": "admin" } }`
**401** `{ "error": "Invalid or expired token" }`

Try it:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 8. Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server, restarts on file change |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Types only, no output |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Create `admin`/`admin123`, or `npm run db:seed -- user pass` |
| `npm run db:check` | Print connection status and tables |

---

## 9. Troubleshooting

**`SyntaxError: Unexpected token '?'`**
Wrong Node. See section 1.

**`ER_ACCESS_DENIED_ERROR` / `Access denied for user 'rd_app'@'localhost'`**
`DB_USER`/`DB_PASSWORD` in `.env` do not match what `setup-database.sql` created.
The two files must agree. Re-run `sudo mysql < setup-database.sql`.

**`ER_BAD_DB_ERROR: Unknown database 'rd_collections'`**
Step 2 of setup has not been run.

**`ECONNREFUSED 127.0.0.1:3306`**
MySQL is not running: `sudo systemctl start mysql`.

**`connect ETIMEDOUT` (hangs, rather than refusing straight away)**
`DB_PORT` points at something that is listening but is not MySQL — a timeout means
something answered the TCP connection and then never spoke MySQL, whereas a wrong
*closed* port refuses instantly. Confirm which port MySQL is really on:

```bash
ss -ltnp | grep -E '3306|mysql'
```

MySQL on this machine is on **3306** (33060 is its X protocol, not for this driver).

**`Missing required environment variable ...`**
That key is blank in `.env`. `.env.example` lists them all.

**`EADDRINUSE`**
Port 3000 is taken. Change `PORT` in `.env`, or `lsof -i :3000` to find the culprit.

**Login returns 401 with the right password**
Was the user actually created? `npm run db:check` shows the row count, and
`npm run db:seed` reports whether the account already existed.

---

## 10. Before this goes to production

- [ ] Change the seeded `admin` password
- [ ] A fresh `JWT_SECRET` — the dev one has sat in a working copy
- [ ] `NODE_ENV=production`, which stops error details being returned to clients
- [ ] `CORS_ORIGIN` set to the real site origin, not `localhost:4200`
- [ ] TLS in front of the API — login posts a password in the request body
- [ ] Rate-limit `POST /api/auth/login`; nothing currently slows down guessing

### `GET /api/customers`

Requires a token. Every customer, sorted by customer name.

### `POST /api/customers`

Requires a token.

```json
{ "customerName": "Sharma Caterers", "isRegular": true, "contactPerson": "Ramesh Sharma",
  "phone": "98765 43210", "email": "", "city": "Pune", "address": "", "gstin": "" }
```

**201** `{ "customer": { ... } }`
**400** — no customer name, `isRegular` missing or not true/false, a phone without 7 to 15 digits, a bad email, or a GSTIN
not in the 15-character format
**409** — a customer with that phone already exists

### `PUT /api/customers/:id`

Requires a token. Takes the same body as `POST` and replaces every field.

**200** `{ "customer": { ... } }`
**400** — same checks as `POST`
**404** — no customer with that id
**409** — another customer already has that phone

### `PATCH /api/customers/:id/status`

Requires a token. `{ "isActive": false }` to deactivate, `true` to reactivate.

**200** `{ "customer": { ... } }`
**400** — `isActive` missing or not true/false
**404** — no customer with that id

### `GET /api/customers/:id/rates`

Requires a token. `{ "rates": [ { "product_id": 8, "rate": 1.5, "updated_at": "..." } ] }`
**404** if the customer does not exist.

### `PUT /api/customers/:id/rates`

Requires a token. Send only the products that changed. A number sets the rate,
and `null` removes it. Every other rate is left alone. Applied in one transaction.

```json
{ "rates": [ { "productId": 8, "rate": 1.5 }, { "productId": 6, "rate": null } ] }
```

**200** — the customer's full set of rates after the save
**400** — negative rate, more than 2 decimals, the same product twice, or an
unknown product
**404** — no customer with that id

### `PUT /api/products/:id`

Requires a token. Takes the same body as `POST /api/products` and replaces every field.

**200** `{ "product": { ... } }`
**400** — same checks as `POST`
**404** — no product with that id
**409** — that name already exists in that material

Changing `quantityUnit` does not touch past purchases (each line keeps the unit it
was bought in) or customer rates.

### `GET /api/sales`

Requires a token. Every sale, newest date first, with `customer_name` and its `items`.

### `POST /api/sales`

Requires a token.

```json
{ "saleDate": "2026-09-24", "customerId": 3,
  "items": [ { "productId": 8, "quantity": 10, "unitPrice": 1.5 } ] }
```

**201** `{ "sale": { ..., "items": [ ... ] } }`
**400** — bad date, no customer, an inactive or missing customer, no items,
quantity ≤ 0, negative rate, or an unknown product

Totals are computed on the server. Selling more than is in stock is allowed.

### `GET /api/sales/last-prices?customerId=N`

Requires a token. For each product ever sold to that customer, the `unit_price` and
`sale_date` of the most recent sale. The Sell dialog shows this as "Last", next to
the customer's saved rate.
