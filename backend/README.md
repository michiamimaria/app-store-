# SmartHub Backend (Express)

This folder contains the SmartHub API used by the mobile/web app.

## Prerequisites

- Node.js 18+

## Setup

```powershell
cd "c:\Users\Marija Velkovska\OneDrive\Desktop\app store\backend"
npm install
```

## Run (dev)

```powershell
npm run dev
```

## Run (prod)

```powershell
npm start
```

## Endpoints

### Health

- `GET /health`

### Products + price comparison (demo catalog)

- `GET /api/products`
  - Optional query params: `brand`, `maxPrice`, `condition` (`new`/`used`), `category`
- `GET /api/products/compare?ids=1,3,5`
  - Returns products ranked by the lowest offer price and a `bestDeal`.

### AI (demo stub)

- `POST /api/ai/suggest`
  - Body: `{ "query": "Best phone under $500?" }`
  - Returns a placeholder reply (swap with a real LLM later).

### Payments (demo + optional Stripe)

- `GET /api/payments/methods`
  - Returns `{ methods: [...], stripeEnabled: boolean }` — `stripeEnabled` is true when `STRIPE_SECRET_KEY` is set in `.env`.
- `POST /api/payments/validate`
  - Body: `{ "paymentMethodId": "card" }`
  - Returns `{ ok, paymentMethodId, label }` or `400` if id is unknown

### Stripe Checkout (web / Chrome)

Set `STRIPE_SECRET_KEY=sk_test_...` in `backend/.env` and restart the API. The web app can start hosted Checkout and return to the same origin.

- `POST /api/cart/stripe-checkout-session` (header `X-Session-Id`)
  - Body: `{ "origin": "http://localhost:8095" }` — must be `http(s)://localhost` or `127.0.0.1`, or match `STRIPE_ALLOWED_ORIGINS` (comma-separated).
  - Returns `{ url, checkoutSessionId }` — open `url` in the browser to pay (test card e.g. `4242 4242 4242 4242`).
- `POST /api/cart/stripe-verify` (header `X-Session-Id`)
  - Body: `{ "stripeSessionId": "<id from return URL>" }` — run after redirect `?stripe_checkout=success&session_id=...` to clear the basket.

Demo checkout without Stripe still uses `POST /api/cart/checkout` with `paymentMethodId`.

### Basket / reservation / checkout (demo)

The cart is stored in-memory per device session id.

Client must send header: `X-Session-Id: <any device id>`

- `GET /api/cart`
  - Returns `{ lines, subtotal, itemCount, reservedUntil, reservationActive }`
- `POST /api/cart/items`
  - Body: `{ "productId": "21", "offerId": "21b", "quantity": 1 }`
- `PATCH /api/cart/items/:lineId`
  - Body: `{ "quantity": 2 }`
- `DELETE /api/cart/items/:lineId`
- `DELETE /api/cart`
  - Clears the basket.
- `POST /api/cart/reserve`
  - Body: `{ "minutes": 20 }` (default is 15; clamped to 5-120)
- `POST /api/cart/checkout`
  - Body: `{ "paymentMethodId": "card" }` — must match an `id` from `GET /api/payments/methods`
  - Clears the basket and returns `{ orderId, paid, itemCount, paymentMethodId, paymentMethodLabel, message }`

## Notes

- Prices and retailer links are demo data. The `source.listingUrl` is a simulated deep link.
- Replace the in-memory catalog + cart with MongoDB/Postgres + auth for production.

