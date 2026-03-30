import { Router } from "express";

export const aiRouter = Router();

aiRouter.post("/suggest", (req, res) => {
  const { query } = req.body || {};
  const q = typeof query === "string" ? query.toLowerCase() : "";

  if (!q.trim()) {
    return res.status(400).json({ error: "Missing query" });
  }

  let reply =
    "Try filters in the marketplace: brand, max price, condition, and category. Connect an LLM API here for full answers.";

  if (q.includes("500") || q.includes("under")) {
    reply =
      "Under $500: consider Xiaomi 14 (used) or similar mid-range Android. Verify seller ratings before purchase.";
  }
  if (q.includes("iphone") && q.includes("samsung")) {
    reply =
      "iPhone: iOS, long software support, strong resale. Samsung: flexible Android, often better zoom/screens on Ultra. Pick based on ecosystem and camera style.";
  }

  res.json({
    reply,
    note: "Replace this route with your AI provider (OpenAI, etc.) for production.",
  });
});
