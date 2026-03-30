import { randomUUID } from "crypto";
import { Router } from "express";
import { getListingById } from "./products.js";

export const cartRouter = Router();

/** @typedef {{ lineId: string; productId: string; offerId: string; quantity: number; title: string; brand: string; currency: string; unitPrice: number; sellerName: string; retailer: string; host: string; listingUrl: string; addedAt: string }} CartLine */

/** @type {Map<string, { lines: CartLine[]; reservedUntil: string | null }>} */
const carts = new Map();

function sessionId(req) {
  const raw = req.headers["x-session-id"] ?? req.headers["X-Session-Id"];
  if (raw == null || typeof raw !== "string") return null;
  const id = raw.trim();
  return id.length > 0 ? id : null;
}

function requireSession(req, res, next) {
  const id = sessionId(req);
  if (!id) {
    return res.status(400).json({ error: "Send header X-Session-Id (your device basket id)." });
  }
  req.sid = id;
  next();
}

function getCart(sid) {
  if (!carts.has(sid)) {
    carts.set(sid, { lines: [], reservedUntil: null });
  }
  return carts.get(sid);
}

function resolveLine(listing, offerId, quantity) {
  const offer = listing.offers.find((o) => o.id === offerId);
  if (!offer) return null;
  const src = offer.source ?? {};
  return {
    lineId: randomUUID(),
    productId: listing.id,
    offerId: offer.id,
    quantity: Math.min(99, Math.max(1, quantity)),
    title: listing.title,
    brand: listing.brand,
    currency: listing.currency,
    unitPrice: offer.price,
    sellerName: offer.sellerName,
    retailer: src.retailer ?? "Store",
    host: src.host ?? "",
    listingUrl: src.listingUrl ?? "",
    addedAt: new Date().toISOString(),
  };
}

function cartTotals(lines) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  return { subtotal, itemCount };
}

cartRouter.use(requireSession);

cartRouter.get("/", (req, res) => {
  const cart = getCart(req.sid);
  const { subtotal, itemCount } = cartTotals(cart.lines);
  res.json({
    lines: cart.lines,
    subtotal,
    itemCount,
    reservedUntil: cart.reservedUntil,
    reservationActive: cart.reservedUntil != null && new Date(cart.reservedUntil) > new Date(),
  });
});

cartRouter.post("/items", (req, res) => {
  const { productId, offerId, quantity = 1 } = req.body ?? {};
  if (!productId || !offerId) {
    return res.status(400).json({ error: "productId and offerId required" });
  }
  const listing = getListingById(productId);
  if (!listing) return res.status(404).json({ error: "Product not found" });

  const line = resolveLine(listing, String(offerId), Number(quantity) || 1);
  if (!line) return res.status(404).json({ error: "Offer not found on product" });

  const cart = getCart(req.sid);
  const existing = cart.lines.find((l) => l.productId === line.productId && l.offerId === line.offerId);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + line.quantity);
    existing.unitPrice = line.unitPrice;
    existing.listingUrl = line.listingUrl;
    existing.retailer = line.retailer;
    existing.host = line.host;
  } else {
    cart.lines.push(line);
  }

  const { subtotal, itemCount } = cartTotals(cart.lines);
  res.status(201).json({ ok: true, lines: cart.lines, subtotal, itemCount });
});

cartRouter.patch("/items/:lineId", (req, res) => {
  const { quantity } = req.body ?? {};
  const q = Number(quantity);
  if (Number.isNaN(q) || q < 1) {
    return res.status(400).json({ error: "quantity must be >= 1" });
  }
  const cart = getCart(req.sid);
  const line = cart.lines.find((l) => l.lineId === req.params.lineId);
  if (!line) return res.status(404).json({ error: "Line not found" });
  line.quantity = Math.min(99, q);
  const { subtotal, itemCount } = cartTotals(cart.lines);
  res.json({ ok: true, lines: cart.lines, subtotal, itemCount });
});

cartRouter.delete("/items/:lineId", (req, res) => {
  const cart = getCart(req.sid);
  cart.lines = cart.lines.filter((l) => l.lineId !== req.params.lineId);
  const { subtotal, itemCount } = cartTotals(cart.lines);
  res.json({ ok: true, lines: cart.lines, subtotal, itemCount });
});

cartRouter.delete("/", (req, res) => {
  const cart = getCart(req.sid);
  cart.lines = [];
  cart.reservedUntil = null;
  res.json({ ok: true, lines: [], subtotal: 0, itemCount: 0 });
});

/** Hold basket prices for demo (e.g. 15 minutes) — extend with payment provider in production */
cartRouter.post("/reserve", (req, res) => {
  const minutes = Math.min(120, Math.max(5, Number(req.body?.minutes) || 15));
  const cart = getCart(req.sid);
  if (cart.lines.length === 0) {
    return res.status(400).json({ error: "Basket is empty" });
  }
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  cart.reservedUntil = until;
  res.json({
    ok: true,
    reservedUntil: until,
    minutes,
    message: `Items reserved at listed prices for ${minutes} minutes (demo).`,
  });
});

/** Mock checkout — swap for Stripe / PayPal / in-app billing */
cartRouter.post("/checkout", (req, res) => {
  const cart = getCart(req.sid);
  if (cart.lines.length === 0) {
    return res.status(400).json({ error: "Basket is empty" });
  }
  const { subtotal, itemCount } = cartTotals(cart.lines);
  const orderId = randomUUID();
  cart.lines = [];
  cart.reservedUntil = null;
  res.json({
    ok: true,
    orderId,
    paid: subtotal,
    itemCount,
    message: "Demo checkout complete — connect a payment gateway for real charges.",
  });
});
