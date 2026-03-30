# SmartHub - Universal Marketplace for Mobile Devices & Accessories

SmartHub is a cross-platform marketplace that lets users:
- Discover phones and accessories
- Compare prices across multiple sellers/retailers
- Reserve prices for a short window (demo)
- Checkout (demo) and open the listing URL for the best offer

This repo contains:
- `backend/` - Node.js + Express API (products, price compare, cart/checkout flow)
- `mobile/` - Expo (React Native) UI (marketplace, compare sheet, basket modal)

## Documentation

More detail lives in each package:

- **[Backend API](backend/README.md)** — install/run, health check, product + compare routes, cart (`X-Session-Id`), reserve & checkout (demo).
- **[Mobile & web app](mobile/README.md)** — Expo setup, run in Chrome / Android / iOS, and how the UI connects to the API (localhost vs Android emulator).

## Features (current demo)

1. Marketplace catalog
   - Categories: Smartphones, Headphones, Chargers, Smartwatches, Accessories
   - Filters: brand search (title/brand), category chips, condition (new/used)
2. Multi-seller price comparison
   - Each product includes multiple seller offers
   - Offers are shown sorted by price in a bottom sheet
3. Basket + reservation + checkout (demo)
   - Add offer to basket
   - Reserve basket prices for N minutes (demo)
   - Checkout clears the basket (demo)
4. Retailer/site metadata (demo)
   - Each offer includes a simulated retailer name + host + listing URL
   - Tapping a site row opens the listing URL

## Tech Stack

- Mobile/Web UI: Expo + React Native + TypeScript
- Backend: Node.js + Express
- Data: in-memory demo catalog (ready to replace with MongoDB/Postgres)

## Local Setup

### 1) Start the backend API

```powershell
cd "c:\Users\Marija Velkovska\OneDrive\Desktop\app store\backend"
npm install
npm run dev
```

Default API port: `3001`
- Health check: `http://localhost:3001/health`

### 2) Start the mobile app (Expo web for Chrome)

```powershell
cd "c:\Users\Marija Velkovska\OneDrive\Desktop\app store\mobile"
npm install
npx expo start --web
```

Expo web will print a URL like `http://localhost:808X`.

### Android/iOS
If you plan to run native apps:
- Android: `npx expo start --android`
- iOS requires macOS: `npx expo start --ios`

## Basket / Reservation Notes

- The cart uses a simple device session id stored in `AsyncStorage`.
- Reservation and checkout are implemented as demo endpoints:
  - `POST /api/cart/reserve`
  - `POST /api/cart/checkout`

## Next Improvements (recommended)

- Replace demo catalog with a real database + seller feeds
- Integrate a real AI assistant endpoint (LLM provider)
- Replace demo checkout with Stripe/PayPal (or your payment provider)
- Add authenticated wishlist, chat, and order history
