import Stripe from "stripe";

let _stripe = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Accept localhost and optional comma-separated origins (e.g. Expo tunnel). */
export function validateCheckoutOrigin(origin) {
  if (typeof origin !== "string") return null;
  const trimmed = origin.trim().replace(/\/$/, "");
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal && (u.protocol === "http:" || u.protocol === "https:")) {
      return `${u.protocol}//${u.host}`;
    }
    const extras = (process.env.STRIPE_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    const norm = trimmed.replace(/\/$/, "");
    if (extras.some((e) => norm === e || norm.startsWith(`${e}/`))) {
      return norm.split("/").slice(0, 3).join("/");
    }
    return null;
  } catch {
    return null;
  }
}
