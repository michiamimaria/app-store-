import { randomUUID } from "crypto";
import { Router } from "express";
import { getListingById } from "./products.js";
import { getPaymentMethodLabel, isValidPaymentMethodId } from "./payments.js";
import { getStripe, validateCheckoutOrigin } from "../stripeClient.js";

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

/**
 * Stripe Checkout — returns hosted payment URL. Cart stays until /stripe-verify after success.
 * Body: { "origin": "http://localhost:8095" } (must be localhost or listed in STRIPE_ALLOWED_ORIGINS).
 */
cartRouter.post("/stripe-checkout-session", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env (use a test key from Stripe Dashboard).",
    });
  }
  const cart = getCart(req.sid);
  if (cart.lines.length === 0) {
    return res.status(400).json({ error: "Basket is empty" });
  }
  const base = validateCheckoutOrigin(req.body?.origin);
  if (!base) {
    return res.status(400).json({
      error:
        "Invalid origin. Send JSON { origin: window.location.origin } from the web app. Allowed: localhost, 127.0.0.1, or STRIPE_ALLOWED_ORIGINS.",
    });
  }
  const currencies = new Set(cart.lines.map((l) => String(l.currency || "usd").toLowerCase()));
  if (currencies.size !== 1) {
    return res.status(400).json({ error: "Basket lines must share one currency for Stripe." });
  }
  const currency = [...currencies][0];
  const line_items = cart.lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency,
      unit_amount: Math.round(Number(line.unitPrice) * 100),
      product_data: {
        name: String(line.title).slice(0, 120),
      },
    },
  }));
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${base}/?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?stripe_checkout=cancel`,
      metadata: { smarthubSession: req.sid },
    });
    res.json({ url: session.url, checkoutSessionId: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-checkout-session]", msg);
    res.status(502).json({ error: `Stripe error: ${msg}` });
  }
});

/** After Stripe redirects back with ?session_id=… — confirms payment and clears basket. */
cartRouter.post("/stripe-verify", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: "Stripe not configured" });
  }
  const stripeSessionId = req.body?.stripeSessionId;
  if (!stripeSessionId || typeof stripeSessionId !== "string") {
    return res.status(400).json({ error: "stripeSessionId required" });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId.trim());
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Checkout session is not paid yet." });
    }
    const metaSid = session.metadata?.smarthubSession;
    if (!metaSid || metaSid !== req.sid) {
      return res.status(403).json({ error: "This payment does not match your basket session." });
    }
    const cart = getCart(req.sid);
    if (cart.lines.length === 0) {
      return res.json({
        ok: true,
        alreadyCleared: true,
        stripeCheckoutSessionId: session.id,
        message: "Order already finalized.",
      });
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
      stripeCheckoutSessionId: session.id,
      message: "Payment confirmed with Stripe.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-verify]", msg);
    res.status(502).json({ error: `Stripe error: ${msg}` });
  }
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

/**
 * Mock checkout — requires paymentMethodId from GET /api/payments/methods.
 * Swap for Stripe PaymentIntent / PayPal order capture in production.
 */
cartRouter.post("/checkout", (req, res) => {
  const cart = getCart(req.sid);
  if (cart.lines.length === 0) {
    return res.status(400).json({ error: "Basket is empty" });
  }
  const paymentMethodId = req.body?.paymentMethodId;
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({
      error: "Valid paymentMethodId required (see GET /api/payments/methods).",
    });
  }
  const { subtotal, itemCount } = cartTotals(cart.lines);
  const orderId = randomUUID();
  cart.lines = [];
  cart.reservedUntil = null;
  const methodLabel = getPaymentMethodLabel(paymentMethodId);
  res.json({
    ok: true,
    orderId,
    paid: subtotal,
    itemCount,
    paymentMethodId,
    paymentMethodLabel: methodLabel,
    message: `Demo order paid with ${methodLabel}. Connect Stripe or PayPal for real charges.`,
  });
});
