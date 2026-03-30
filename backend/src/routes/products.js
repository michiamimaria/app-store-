import { Router } from "express";

export const productsRouter = Router();

/**
 * Simulated “aggregated from the web” retailers. In production, replace with partner APIs,
 * affiliate feeds, or compliant scraping pipelines — URLs here are demo tracking links only.
 */
const PRICE_SOURCES = [
  { name: "Amazon", host: "amazon.com", baseUrl: "https://www.amazon.com" },
  { name: "Best Buy", host: "bestbuy.com", baseUrl: "https://www.bestbuy.com" },
  { name: "Newegg", host: "newegg.com", baseUrl: "https://www.newegg.com" },
  { name: "Walmart", host: "walmart.com", baseUrl: "https://www.walmart.com" },
  { name: "B&H Photo", host: "bhphotovideo.com", baseUrl: "https://www.bhphotovideo.com" },
  { name: "Target", host: "target.com", baseUrl: "https://www.target.com" },
  { name: "MediaMarkt", host: "mediamarkt.de", baseUrl: "https://www.mediamarkt.de" },
  { name: "Fnac", host: "fnac.com", baseUrl: "https://www.fnac.com" },
];

/** @typedef {{ id: string; sellerName: string; price: number; verified: boolean; shipping: string; eta: string; sellerRating: number }} OfferRaw */

function attachWebSource(offer, productId) {
  let h = 0;
  const key = `${offer.id}:${productId}`;
  for (let i = 0; i < key.length; i++) h = Math.imul(31, h) + key.charCodeAt(i);
  const site = PRICE_SOURCES[Math.abs(h) % PRICE_SOURCES.length];
  const slug = encodeURIComponent(`${productId}-${offer.id}`);
  return {
    ...offer,
    source: {
      retailer: site.name,
      host: site.host,
      listingUrl: `${site.baseUrl}/dp/smart-hub-${slug}`,
      lastCheckedAt: new Date().toISOString(),
    },
  };
}

/** Raw catalog: each product has multiple seller offers for price comparison */
const rawCatalog = [
  {
    id: "1",
    title: "iPhone 15 Pro 256GB · Natural Titanium",
    brand: "Apple",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.85,
    specs: { ramGb: 8, storageGb: 256, cameraMp: 48 },
    offers: [
      { id: "1a", sellerName: "TechVault Pro", price: 999, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "1b", sellerName: "MobileHub EU", price: 1029, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.8 },
      { id: "1c", sellerName: "GadgetLane", price: 979, verified: true, shipping: "$6.99", eta: "3 days", sellerRating: 4.7 },
      { id: "1d", sellerName: "SwiftCell", price: 1049, verified: false, shipping: "Free", eta: "5 days", sellerRating: 4.4 },
    ],
  },
  {
    id: "2",
    title: "iPhone 14 128GB · Midnight",
    brand: "Apple",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.75,
    specs: { ramGb: 6, storageGb: 128, cameraMp: 12 },
    offers: [
      { id: "2a", sellerName: "Apple Reseller Nordic", price: 699, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "2b", sellerName: "TechVault Pro", price: 729, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "2c", sellerName: "PhoneCraft", price: 659, verified: true, shipping: "$4.99", eta: "4 days", sellerRating: 4.6 },
      { id: "2d", sellerName: "CityMobiles", price: 749, verified: false, shipping: "Free", eta: "1 week", sellerRating: 4.2 },
    ],
  },
  {
    id: "3",
    title: "Samsung Galaxy S24 Ultra 256GB",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.78,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 200 },
    offers: [
      { id: "3a", sellerName: "Samsung Store Official", price: 1199, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "3b", sellerName: "Galaxy Deals", price: 1129, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.75 },
      { id: "3c", sellerName: "ElectroMart", price: 1175, verified: true, shipping: "$9", eta: "3 days", sellerRating: 4.65 },
      { id: "3d", sellerName: "ImportDirect", price: 1089, verified: false, shipping: "$19", eta: "10 days", sellerRating: 4.1 },
      { id: "3e", sellerName: "TechVault Pro", price: 1149, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.95 },
    ],
  },
  {
    id: "4",
    title: "Samsung Galaxy A55 5G 128GB",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.55,
    specs: { ramGb: 8, storageGb: 128, cameraMp: 50 },
    offers: [
      { id: "4a", sellerName: "Galaxy Deals", price: 379, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.75 },
      { id: "4b", sellerName: "ElectroMart", price: 399, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "4c", sellerName: "BudgetPhones Co.", price: 359, verified: true, shipping: "$5", eta: "5 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "5",
    title: "Xiaomi 14 512GB · Black",
    brand: "Xiaomi",
    category: "Smartphones",
    condition: "used",
    currency: "USD",
    rating: 4.52,
    specs: { ramGb: 12, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "5a", sellerName: "Mi Zone", price: 549, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.7 },
      { id: "5b", sellerName: "AsiaImport Hub", price: 519, verified: true, shipping: "$12", eta: "8 days", sellerRating: 4.55 },
      { id: "5c", sellerName: "RefurbKing", price: 489, verified: true, shipping: "Free", eta: "1 week", sellerRating: 4.8 },
      { id: "5d", sellerName: "LocalTrader", price: 575, verified: false, shipping: "Pickup", eta: "Same day", sellerRating: 4.0 },
    ],
  },
  {
    id: "6",
    title: "Xiaomi Redmi Note 13 Pro+ 256GB",
    brand: "Xiaomi",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.48,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 200 },
    offers: [
      { id: "6a", sellerName: "Mi Zone", price: 329, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.7 },
      { id: "6b", sellerName: "ValueTech", price: 349, verified: true, shipping: "$3.99", eta: "2 days", sellerRating: 4.5 },
      { id: "6c", sellerName: "FlashSale EU", price: 315, verified: false, shipping: "$8", eta: "6 days", sellerRating: 4.2 },
    ],
  },
  {
    id: "7",
    title: "Huawei Pura 70 Ultra 512GB",
    brand: "Huawei",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.62,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "7a", sellerName: "Huawei Flagship Store", price: 1199, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.85 },
      { id: "7b", sellerName: "AsiaImport Hub", price: 1099, verified: true, shipping: "$15", eta: "12 days", sellerRating: 4.55 },
      { id: "7c", sellerName: "GlobalMobile", price: 1149, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.6 },
    ],
  },
  {
    id: "8",
    title: "Google Pixel 8 Pro 128GB",
    brand: "Google",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.7,
    specs: { ramGb: 12, storageGb: 128, cameraMp: 50 },
    offers: [
      { id: "8a", sellerName: "Google Store Partner", price: 899, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.92 },
      { id: "8b", sellerName: "PixelPerfect", price: 869, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.7 },
      { id: "8c", sellerName: "TechVault Pro", price: 929, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.95 },
      { id: "8d", sellerName: "OpenBox Outlet", price: 799, verified: false, shipping: "$9.99", eta: "1 week", sellerRating: 4.3 },
    ],
  },
  {
    id: "9",
    title: "OnePlus 12 256GB · Flowy Emerald",
    brand: "OnePlus",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.58,
    specs: { ramGb: 16, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "9a", sellerName: "OnePlus Official", price: 799, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.88 },
      { id: "9b", sellerName: "SpeedPhone", price: 769, verified: true, shipping: "$5", eta: "4 days", sellerRating: 4.55 },
      { id: "9c", sellerName: "ImportDirect", price: 739, verified: false, shipping: "$22", eta: "14 days", sellerRating: 4.1 },
    ],
  },
  {
    id: "10",
    title: "AirPods Pro (2nd gen) · USB-C",
    brand: "Apple",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.65,
    specs: {},
    offers: [
      { id: "10a", sellerName: "Apple Reseller Nordic", price: 249, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "10b", sellerName: "SoundSphere", price: 229, verified: true, shipping: "$3.50", eta: "3 days", sellerRating: 4.72 },
      { id: "10c", sellerName: "TechVault Pro", price: 239, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "10d", sellerName: "Warehouse Audio", price: 219, verified: false, shipping: "$6", eta: "5 days", sellerRating: 4.35 },
    ],
  },
  {
    id: "11",
    title: "Samsung Galaxy Buds3 Pro",
    brand: "Samsung",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.5,
    specs: {},
    offers: [
      { id: "11a", sellerName: "Galaxy Deals", price: 199, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.75 },
      { id: "11b", sellerName: "ElectroMart", price: 189, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "11c", sellerName: "Buds Boutique", price: 209, verified: true, shipping: "$4", eta: "4 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "12",
    title: "Sony WH-1000XM5 · Silver",
    brand: "Sony",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.72,
    specs: {},
    offers: [
      { id: "12a", sellerName: "SoundSphere", price: 348, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.72 },
      { id: "12b", sellerName: "AudioNation", price: 329, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.68 },
      { id: "12c", sellerName: "TechVault Pro", price: 359, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "12d", sellerName: "OpenBox Outlet", price: 299, verified: false, shipping: "$8", eta: "1 week", sellerRating: 4.3 },
    ],
  },
  {
    id: "13",
    title: "Anker Prime 737 · 120W GaN Charger",
    brand: "Anker",
    category: "Chargers",
    condition: "new",
    currency: "USD",
    rating: 4.6,
    specs: { watts: 120 },
    offers: [
      { id: "13a", sellerName: "Anker Official", price: 89, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.85 },
      { id: "13b", sellerName: "CableCraft", price: 79, verified: true, shipping: "$2.99", eta: "4 days", sellerRating: 4.55 },
      { id: "13c", sellerName: "ElectroMart", price: 84, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "14",
    title: "Apple MagSafe Charger + 20W USB-C",
    brand: "Apple",
    category: "Chargers",
    condition: "new",
    currency: "USD",
    rating: 4.45,
    specs: {},
    offers: [
      { id: "14a", sellerName: "Apple Reseller Nordic", price: 47, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "14b", sellerName: "TechVault Pro", price: 45, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "14c", sellerName: "AccessoryBay", price: 39, verified: false, shipping: "$3", eta: "5 days", sellerRating: 4.2 },
    ],
  },
  {
    id: "15",
    title: "Belkin BoostCharge Pro 3-in-1 MagSafe",
    brand: "Belkin",
    category: "Chargers",
    condition: "new",
    currency: "USD",
    rating: 4.38,
    specs: {},
    offers: [
      { id: "15a", sellerName: "Belkin Store EU", price: 139, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.6 },
      { id: "15b", sellerName: "AccessoryBay", price: 119, verified: true, shipping: "$4.99", eta: "5 days", sellerRating: 4.4 },
      { id: "15c", sellerName: "ElectroMart", price: 129, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "16",
    title: "Apple Watch Series 10 · 46mm Jet Black",
    brand: "Apple",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.68,
    specs: {},
    offers: [
      { id: "16a", sellerName: "Apple Reseller Nordic", price: 449, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "16b", sellerName: "WearTech", price: 429, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.62 },
      { id: "16c", sellerName: "TechVault Pro", price: 439, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "16d", sellerName: "OpenBox Outlet", price: 399, verified: false, shipping: "$7", eta: "6 days", sellerRating: 4.25 },
    ],
  },
  {
    id: "17",
    title: "Samsung Galaxy Watch7 · 44mm",
    brand: "Samsung",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.52,
    specs: {},
    offers: [
      { id: "17a", sellerName: "Galaxy Deals", price: 299, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.75 },
      { id: "17b", sellerName: "Samsung Store Official", price: 319, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "17c", sellerName: "WearTech", price: 289, verified: true, shipping: "$4", eta: "4 days", sellerRating: 4.62 },
    ],
  },
  {
    id: "18",
    title: "Xiaomi Smart Band 9 Pro",
    brand: "Xiaomi",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.4,
    specs: {},
    offers: [
      { id: "18a", sellerName: "Mi Zone", price: 89, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.7 },
      { id: "18b", sellerName: "ValueTech", price: 79, verified: true, shipping: "$2.99", eta: "3 days", sellerRating: 4.5 },
      { id: "18c", sellerName: "FlashSale EU", price: 72, verified: false, shipping: "$5", eta: "7 days", sellerRating: 4.15 },
    ],
  },
  {
    id: "19",
    title: "Huawei Watch GT 5 Pro · Titanium",
    brand: "Huawei",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.55,
    specs: {},
    offers: [
      { id: "19a", sellerName: "Huawei Flagship Store", price: 369, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.85 },
      { id: "19b", sellerName: "WearTech", price: 349, verified: true, shipping: "$6", eta: "5 days", sellerRating: 4.62 },
      { id: "19c", sellerName: "AsiaImport Hub", price: 329, verified: true, shipping: "$12", eta: "10 days", sellerRating: 4.55 },
    ],
  },
  {
    id: "20",
    title: "Spigen Ultra Hybrid · iPhone 15 Pro",
    brand: "Spigen",
    category: "Accessories",
    condition: "new",
    currency: "USD",
    rating: 4.35,
    specs: {},
    offers: [
      { id: "20a", sellerName: "AccessoryBay", price: 24, verified: true, shipping: "$2.99", eta: "3 days", sellerRating: 4.4 },
      { id: "20b", sellerName: "CaseKing", price: 19, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.5 },
      { id: "20c", sellerName: "ElectroMart", price: 22, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "21",
    title: "iPhone 16 Pro 256GB · Desert Titanium",
    brand: "Apple",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.88,
    specs: { ramGb: 8, storageGb: 256, cameraMp: 48 },
    offers: [
      { id: "21a", sellerName: "Apple Reseller Nordic", price: 1099, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.92 },
      { id: "21b", sellerName: "TechVault Pro", price: 1129, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.95 },
      { id: "21c", sellerName: "MobileHub EU", price: 1079, verified: true, shipping: "$8", eta: "3 days", sellerRating: 4.8 },
      { id: "21d", sellerName: "ImportDirect", price: 1049, verified: false, shipping: "$18", eta: "9 days", sellerRating: 4.15 },
    ],
  },
  {
    id: "22",
    title: "iPhone 16 128GB · Ultramarine",
    brand: "Apple",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.8,
    specs: { ramGb: 8, storageGb: 128, cameraMp: 48 },
    offers: [
      { id: "22a", sellerName: "TechVault Pro", price: 829, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "22b", sellerName: "Apple Reseller Nordic", price: 799, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "22c", sellerName: "GadgetLane", price: 849, verified: true, shipping: "$5", eta: "4 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "23",
    title: "iPhone 13 128GB · Starlight (renewed excellent)",
    brand: "Apple",
    category: "Smartphones",
    condition: "used",
    currency: "USD",
    rating: 4.55,
    specs: { ramGb: 4, storageGb: 128, cameraMp: 12 },
    offers: [
      { id: "23a", sellerName: "RefurbKing", price: 389, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.8 },
      { id: "23b", sellerName: "OpenBox Outlet", price: 359, verified: true, shipping: "$6", eta: "1 week", sellerRating: 4.35 },
      { id: "23c", sellerName: "PhoneCraft", price: 419, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.6 },
    ],
  },
  {
    id: "24",
    title: "Samsung Galaxy S25 Ultra 512GB · Titanium Gray",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.82,
    specs: { ramGb: 12, storageGb: 512, cameraMp: 200 },
    offers: [
      { id: "24a", sellerName: "Samsung Store Official", price: 1419, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "24b", sellerName: "Galaxy Deals", price: 1349, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.75 },
      { id: "24c", sellerName: "ElectroMart", price: 1379, verified: true, shipping: "$9", eta: "3 days", sellerRating: 4.65 },
      { id: "24d", sellerName: "TechVault Pro", price: 1399, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.95 },
    ],
  },
  {
    id: "25",
    title: "Samsung Galaxy S25 256GB",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.72,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "25a", sellerName: "Galaxy Deals", price: 799, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.75 },
      { id: "25b", sellerName: "Samsung Store Official", price: 859, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "25c", sellerName: "ElectroMart", price: 779, verified: true, shipping: "$7", eta: "4 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "26",
    title: "Samsung Galaxy Z Flip6 256GB · Mint",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.6,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "26a", sellerName: "Samsung Store Official", price: 1099, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "26b", sellerName: "Galaxy Deals", price: 1029, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.75 },
      { id: "26c", sellerName: "FoldFan Store", price: 999, verified: false, shipping: "$14", eta: "8 days", sellerRating: 4.2 },
    ],
  },
  {
    id: "27",
    title: "Samsung Galaxy Z Fold6 512GB · Phantom Black",
    brand: "Samsung",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.65,
    specs: { ramGb: 12, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "27a", sellerName: "Samsung Store Official", price: 1899, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "27b", sellerName: "Galaxy Deals", price: 1799, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.75 },
      { id: "27c", sellerName: "TechVault Pro", price: 1849, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.95 },
    ],
  },
  {
    id: "28",
    title: "Google Pixel 9 Pro XL 256GB",
    brand: "Google",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.76,
    specs: { ramGb: 16, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "28a", sellerName: "Google Store Partner", price: 1099, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.92 },
      { id: "28b", sellerName: "PixelPerfect", price: 1049, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.7 },
      { id: "28c", sellerName: "ElectroMart", price: 1079, verified: true, shipping: "$8", eta: "3 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "29",
    title: "Google Pixel 9a 128GB",
    brand: "Google",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.58,
    specs: { ramGb: 8, storageGb: 128, cameraMp: 48 },
    offers: [
      { id: "29a", sellerName: "PixelPerfect", price: 499, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.7 },
      { id: "29b", sellerName: "Google Store Partner", price: 529, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.92 },
      { id: "29c", sellerName: "ValueTech", price: 479, verified: true, shipping: "$4", eta: "5 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "30",
    title: "Xiaomi 15 Ultra 512GB · White",
    brand: "Xiaomi",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.68,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "30a", sellerName: "Mi Zone", price: 1199, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.7 },
      { id: "30b", sellerName: "AsiaImport Hub", price: 1099, verified: true, shipping: "$16", eta: "11 days", sellerRating: 4.55 },
      { id: "30c", sellerName: "GlobalMobile", price: 1149, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.6 },
    ],
  },
  {
    id: "31",
    title: "Xiaomi Poco F6 Pro 512GB",
    brand: "Xiaomi",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.52,
    specs: { ramGb: 12, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "31a", sellerName: "Mi Zone", price: 429, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.7 },
      { id: "31b", sellerName: "FlashSale EU", price: 399, verified: false, shipping: "$7", eta: "6 days", sellerRating: 4.2 },
      { id: "31c", sellerName: "ValueTech", price: 449, verified: true, shipping: "$3.99", eta: "3 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "32",
    title: "Huawei Mate 70 Pro+ 512GB",
    brand: "Huawei",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.7,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "32a", sellerName: "Huawei Flagship Store", price: 1299, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.85 },
      { id: "32b", sellerName: "AsiaImport Hub", price: 1199, verified: true, shipping: "$18", eta: "14 days", sellerRating: 4.55 },
      { id: "32c", sellerName: "GlobalMobile", price: 1249, verified: true, shipping: "Free", eta: "6 days", sellerRating: 4.6 },
    ],
  },
  {
    id: "33",
    title: "Nothing Phone (3) 256GB",
    brand: "Nothing",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.45,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "33a", sellerName: "Nothing Store EU", price: 599, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.7 },
      { id: "33b", sellerName: "ElectroMart", price: 579, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.65 },
      { id: "33c", sellerName: "SpeedPhone", price: 549, verified: true, shipping: "$6", eta: "5 days", sellerRating: 4.55 },
    ],
  },
  {
    id: "34",
    title: "OnePlus 13 512GB · Arctic Dawn",
    brand: "OnePlus",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.62,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "34a", sellerName: "OnePlus Official", price: 899, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.88 },
      { id: "34b", sellerName: "SpeedPhone", price: 869, verified: true, shipping: "$5", eta: "4 days", sellerRating: 4.55 },
      { id: "34c", sellerName: "TechVault Pro", price: 929, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
    ],
  },
  {
    id: "35",
    title: "Motorola Edge 50 Ultra 512GB",
    brand: "Motorola",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.4,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "35a", sellerName: "ElectroMart", price: 699, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.65 },
      { id: "35b", sellerName: "Galaxy Deals", price: 729, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.75 },
      { id: "35c", sellerName: "ValueTech", price: 669, verified: true, shipping: "$4", eta: "5 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "36",
    title: "ASUS ROG Phone 9 Pro 1TB",
    brand: "ASUS",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.55,
    specs: { ramGb: 24, storageGb: 1024, cameraMp: 50 },
    offers: [
      { id: "36a", sellerName: "Newegg Partner", price: 1199, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.8 },
      { id: "36b", sellerName: "ElectroMart", price: 1149, verified: true, shipping: "$9", eta: "4 days", sellerRating: 4.65 },
      { id: "36c", sellerName: "ImportDirect", price: 1099, verified: false, shipping: "$25", eta: "16 days", sellerRating: 4.1 },
    ],
  },
  {
    id: "37",
    title: "Oppo Find X8 Pro 512GB",
    brand: "Oppo",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.5,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "37a", sellerName: "AsiaImport Hub", price: 999, verified: true, shipping: "$14", eta: "10 days", sellerRating: 4.55 },
      { id: "37b", sellerName: "GlobalMobile", price: 1049, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.6 },
      { id: "37c", sellerName: "Mi Zone", price: 979, verified: true, shipping: "$8", eta: "6 days", sellerRating: 4.7 },
    ],
  },
  {
    id: "38",
    title: "Honor Magic7 Pro 512GB",
    brand: "Honor",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.48,
    specs: { ramGb: 16, storageGb: 512, cameraMp: 50 },
    offers: [
      { id: "38a", sellerName: "GlobalMobile", price: 899, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.6 },
      { id: "38b", sellerName: "AsiaImport Hub", price: 849, verified: true, shipping: "$15", eta: "12 days", sellerRating: 4.55 },
      { id: "38c", sellerName: "ElectroMart", price: 929, verified: true, shipping: "$6", eta: "3 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "39",
    title: "Realme GT 7 Pro 256GB",
    brand: "Realme",
    category: "Smartphones",
    condition: "new",
    currency: "USD",
    rating: 4.42,
    specs: { ramGb: 12, storageGb: 256, cameraMp: 50 },
    offers: [
      { id: "39a", sellerName: "FlashSale EU", price: 449, verified: false, shipping: "$8", eta: "7 days", sellerRating: 4.2 },
      { id: "39b", sellerName: "Mi Zone", price: 479, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.7 },
      { id: "39c", sellerName: "ValueTech", price: 499, verified: true, shipping: "$3.99", eta: "3 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "40",
    title: "AirPods Max (USB-C) · Midnight",
    brand: "Apple",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.58,
    specs: {},
    offers: [
      { id: "40a", sellerName: "Apple Reseller Nordic", price: 549, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "40b", sellerName: "SoundSphere", price: 519, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.72 },
      { id: "40c", sellerName: "TechVault Pro", price: 539, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
    ],
  },
  {
    id: "41",
    title: "Bose QuietComfort Ultra Earbuds",
    brand: "Bose",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.55,
    specs: {},
    offers: [
      { id: "41a", sellerName: "AudioNation", price: 279, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.68 },
      { id: "41b", sellerName: "ElectroMart", price: 299, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "41c", sellerName: "SoundSphere", price: 259, verified: true, shipping: "$4", eta: "4 days", sellerRating: 4.72 },
    ],
  },
  {
    id: "42",
    title: "JBL Tour Pro 3 · ANC earbuds",
    brand: "JBL",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.38,
    specs: {},
    offers: [
      { id: "42a", sellerName: "AudioNation", price: 199, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.68 },
      { id: "42b", sellerName: "Warehouse Audio", price: 179, verified: false, shipping: "$6", eta: "5 days", sellerRating: 4.35 },
      { id: "42c", sellerName: "ElectroMart", price: 189, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "43",
    title: "Beats Studio Pro · Sandstone",
    brand: "Beats",
    category: "Headphones",
    condition: "new",
    currency: "USD",
    rating: 4.5,
    specs: {},
    offers: [
      { id: "43a", sellerName: "Apple Reseller Nordic", price: 349, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "43b", sellerName: "SoundSphere", price: 329, verified: true, shipping: "$3.50", eta: "3 days", sellerRating: 4.72 },
      { id: "43c", sellerName: "Buds Boutique", price: 319, verified: true, shipping: "$4", eta: "4 days", sellerRating: 4.5 },
    ],
  },
  {
    id: "44",
    title: "Samsung 45W Super Fast Charger + cable",
    brand: "Samsung",
    category: "Chargers",
    condition: "new",
    currency: "USD",
    rating: 4.52,
    specs: { watts: 45 },
    offers: [
      { id: "44a", sellerName: "Samsung Store Official", price: 49, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.98 },
      { id: "44b", sellerName: "Galaxy Deals", price: 39, verified: true, shipping: "$2.99", eta: "4 days", sellerRating: 4.75 },
      { id: "44c", sellerName: "CableCraft", price: 35, verified: true, shipping: "$2.99", eta: "4 days", sellerRating: 4.55 },
    ],
  },
  {
    id: "45",
    title: "UGREEN Nexode 100W 3-port GaN charger",
    brand: "UGREEN",
    category: "Chargers",
    condition: "new",
    currency: "USD",
    rating: 4.48,
    specs: { watts: 100 },
    offers: [
      { id: "45a", sellerName: "CableCraft", price: 59, verified: true, shipping: "$2.99", eta: "4 days", sellerRating: 4.55 },
      { id: "45b", sellerName: "ElectroMart", price: 54, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "45c", sellerName: "AccessoryBay", price: 49, verified: true, shipping: "$3", eta: "5 days", sellerRating: 4.4 },
    ],
  },
  {
    id: "46",
    title: "Google Pixel Watch 3 · 45mm LTE",
    brand: "Google",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.5,
    specs: {},
    offers: [
      { id: "46a", sellerName: "Google Store Partner", price: 449, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.92 },
      { id: "46b", sellerName: "WearTech", price: 429, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.62 },
      { id: "46c", sellerName: "ElectroMart", price: 439, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "47",
    title: "Garmin Forerunner 965 · AMOLED GPS",
    brand: "Garmin",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.72,
    specs: {},
    offers: [
      { id: "47a", sellerName: "WearTech", price: 599, verified: true, shipping: "$5", eta: "3 days", sellerRating: 4.62 },
      { id: "47b", sellerName: "ElectroMart", price: 579, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "47c", sellerName: "AudioNation", price: 619, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.68 },
    ],
  },
  {
    id: "48",
    title: "Amazfit Balance · Zepp OS 3",
    brand: "Amazfit",
    category: "Smartwatches",
    condition: "new",
    currency: "USD",
    rating: 4.35,
    specs: {},
    offers: [
      { id: "48a", sellerName: "Mi Zone", price: 199, verified: true, shipping: "Free", eta: "5 days", sellerRating: 4.7 },
      { id: "48b", sellerName: "ValueTech", price: 179, verified: true, shipping: "$2.99", eta: "3 days", sellerRating: 4.5 },
      { id: "48c", sellerName: "FlashSale EU", price: 169, verified: false, shipping: "$5", eta: "7 days", sellerRating: 4.15 },
    ],
  },
  {
    id: "49",
    title: "Apple MagSafe Battery Pack (latest)",
    brand: "Apple",
    category: "Accessories",
    condition: "new",
    currency: "USD",
    rating: 4.28,
    specs: {},
    offers: [
      { id: "49a", sellerName: "Apple Reseller Nordic", price: 99, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.9 },
      { id: "49b", sellerName: "TechVault Pro", price: 95, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "49c", sellerName: "AccessoryBay", price: 89, verified: false, shipping: "$3", eta: "5 days", sellerRating: 4.2 },
    ],
  },
  {
    id: "50",
    title: "Anker MagGo 10K Qi2 power bank",
    brand: "Anker",
    category: "Accessories",
    condition: "new",
    currency: "USD",
    rating: 4.45,
    specs: {},
    offers: [
      { id: "50a", sellerName: "Anker Official", price: 79, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.85 },
      { id: "50b", sellerName: "CableCraft", price: 69, verified: true, shipping: "$2.99", eta: "4 days", sellerRating: 4.55 },
      { id: "50c", sellerName: "ElectroMart", price: 74, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "51",
    title: "Peak Design Mobile Tripod · MagSafe",
    brand: "Peak Design",
    category: "Accessories",
    condition: "new",
    currency: "USD",
    rating: 4.55,
    specs: {},
    offers: [
      { id: "51a", sellerName: "AccessoryBay", price: 129, verified: true, shipping: "$4.99", eta: "5 days", sellerRating: 4.4 },
      { id: "51b", sellerName: "B&H Partner", price: 119, verified: true, shipping: "Free", eta: "4 days", sellerRating: 4.75 },
      { id: "51c", sellerName: "ElectroMart", price: 124, verified: true, shipping: "Free", eta: "3 days", sellerRating: 4.65 },
    ],
  },
  {
    id: "52",
    title: "Logitech MX Keys Mini · Mac layout",
    brand: "Logitech",
    category: "Accessories",
    condition: "new",
    currency: "USD",
    rating: 4.62,
    specs: {},
    offers: [
      { id: "52a", sellerName: "ElectroMart", price: 99, verified: true, shipping: "Free", eta: "2 days", sellerRating: 4.65 },
      { id: "52b", sellerName: "TechVault Pro", price: 109, verified: true, shipping: "Free", eta: "Tomorrow", sellerRating: 4.95 },
      { id: "52c", sellerName: "Newegg Partner", price: 89, verified: true, shipping: "$5", eta: "4 days", sellerRating: 4.8 },
    ],
  },
];

function enrichProduct(p) {
  const offers = p.offers.map((o) => attachWebSource(o, p.id));
  const prices = offers.map((o) => o.price);
  const price = Math.min(...prices);
  const priceHigh = Math.max(...prices);
  const savingsMax = priceHigh - price;
  const verifiedSeller = offers.some((o) => o.verified);
  return {
    ...p,
    offers,
    price,
    priceHigh,
    offerCount: offers.length,
    savingsMax,
    verifiedSeller,
  };
}

const demoListings = rawCatalog.map(enrichProduct);

/** Used by cart API to resolve live prices and retailer metadata */
export function getListingById(productId) {
  return demoListings.find((p) => p.id === String(productId)) ?? null;
}

function applyFilters(list, query) {
  const { brand, maxPrice, condition, category } = query;
  let out = [...list];
  if (brand) {
    const b = String(brand).toLowerCase();
    out = out.filter((p) => p.brand.toLowerCase() === b);
  }
  if (maxPrice) {
    const max = Number(maxPrice);
    if (!Number.isNaN(max)) out = out.filter((p) => p.price <= max);
  }
  if (condition) {
    const c = String(condition).toLowerCase();
    out = out.filter((p) => p.condition === c);
  }
  if (category) {
    const cat = String(category).toLowerCase();
    out = out.filter((p) => p.category.toLowerCase() === cat);
  }
  return out;
}

productsRouter.get("/", (req, res) => {
  const list = applyFilters(demoListings, req.query);
  res.json({ items: list });
});

/** Compare multiple products side-by-side (by product id) */
productsRouter.get("/compare", (req, res) => {
  const rawIds = String(req.query.ids ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const found = demoListings.filter((p) => rawIds.includes(p.id));
  if (found.length === 0) {
    return res.status(404).json({ error: "No products found for comparison" });
  }
  const ranked = [...found].sort((a, b) => a.price - b.price);
  const best = ranked[0];
  res.json({
    products: ranked,
    bestDeal: {
      id: best.id,
      price: best.price,
      title: best.title,
      brand: best.brand,
      savingsVsRest: ranked.slice(1).map((p) => ({
        id: p.id,
        delta: p.price - best.price,
      })),
    },
  });
});

productsRouter.get("/:id/compare", (req, res) => {
  const ids = String(req.params.id)
    .split(",")
    .map((s) => s.trim());
  const found = demoListings.filter((p) => ids.includes(p.id));
  if (found.length === 0) {
    return res.status(404).json({ error: "No products found for comparison" });
  }
  const bestPrice = found.reduce((a, b) => (a.price <= b.price ? a : b));
  res.json({
    products: found,
    bestDeal: { id: bestPrice.id, price: bestPrice.price, title: bestPrice.title },
  });
});
