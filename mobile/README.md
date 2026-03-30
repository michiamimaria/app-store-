# SmartHub Mobile / Web (Expo)

This folder contains the SmartHub UI (mobile + web).

## Setup

```powershell
cd "c:\Users\Marija Velkovska\OneDrive\Desktop\app store\mobile"
npm install
```

## Run (web in Chrome)

```powershell
npx expo start --web
```

Expo will print a URL like `http://localhost:808X`. Open it in Chrome.

## Run (Android)

```powershell
npx expo start --android
```

## Run (iOS)

```powershell
npx expo start --ios
```

## Backend connection

The app calls the API at:

- Android emulator: `http://10.0.2.2:3001`
- Web/desktop: `http://localhost:3001`

Make sure the backend is running.

## Basket + price comparison (current demo)

- Marketplace screen shows products with lowest price from multiple offers.
- Tap a product to open a bottom sheet that shows offers sorted by price.
- Each offer includes a retailer/site row (demo URL). You can open it via tap.
- You can add offers to the basket from the compare sheet.
- Basket modal supports:
  - Reserve prices (`POST /api/cart/reserve`, demo)
  - Checkout (`POST /api/cart/checkout`, demo)

Basket session id is stored on-device using `AsyncStorage`.

