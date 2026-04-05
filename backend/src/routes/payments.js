import { Router } from "express";

/**
 * Demo payment methods — replace with Stripe/PayPal/Adyen session creation in production.
 */
export const PAYMENT_METHODS = [
  {
    id: "card",
    label: "Credit or debit card",
    description: "Visa, Mastercard, Amex (demo — no real charge)",
    provider: "demo_card",
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Pay with your PayPal balance or linked card (demo)",
    provider: "demo_paypal",
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    description: "One-tap checkout on supported devices (demo)",
    provider: "demo_apple_pay",
  },
  {
    id: "google_pay",
    label: "Google Pay",
    description: "Fast checkout on Android (demo)",
    provider: "demo_google_pay",
  },
  {
    id: "bank_transfer",
    label: "Bank transfer",
    description: "SEPA / local transfer instructions after order (demo)",
    provider: "demo_bank",
  },
];

const ALLOWED = new Set(PAYMENT_METHODS.map((m) => m.id));

export function isValidPaymentMethodId(id) {
  return typeof id === "string" && ALLOWED.has(id);
}

export function getPaymentMethodLabel(id) {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}

export const paymentsRouter = Router();

paymentsRouter.get("/methods", (_req, res) => {
  res.json({
    methods: PAYMENT_METHODS,
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  });
});

/** Optional: validate before checkout UI */
paymentsRouter.post("/validate", (req, res) => {
  const { paymentMethodId } = req.body ?? {};
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid or missing paymentMethodId",
      allowed: [...ALLOWED],
    });
  }
  res.json({
    ok: true,
    paymentMethodId,
    label: getPaymentMethodLabel(paymentMethodId),
    message: "Method accepted for demo checkout.",
  });
});
