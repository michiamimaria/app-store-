import "dotenv/config";
import express from "express";
import cors from "cors";
import { productsRouter } from "./routes/products.js";
import { cartRouter } from "./routes/cart.js";
import { aiRouter } from "./routes/ai.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "smarthub-api" });
});

app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/ai", aiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`SmartHub API listening on http://localhost:${PORT}`);
});
