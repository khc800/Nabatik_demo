// server.js
const express = require("express");
const path = require("path");

const app = express();

// Config
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || ""; // e.g. "https://your-frontend.example"

// Basic hardening
app.set("trust proxy", true);
app.disable("x-powered-by");

// Body parsing
app.use(express.json({ limit: "100kb" }));

// CORS for device posts if needed (same-origin frontends work without this)
app.use((req, res, next) => {
  if (ALLOW_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});

// Static frontend
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false, maxAge: "1h", etag: true }));

// In-memory state
let data = { soil_moisture: 0, temperature: 0, diameter: 0 };

// SSE clients
const clients = new Set();

/** Broadcast current data to all SSE clients */
function broadcast() {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) client.write(payload);
}

/** Validate numeric body.value */
function readNumber(req, res) {
  const v = req.body?.value;
  if (typeof v !== "number" || Number.isNaN(v)) {
    res.status(400).json({ error: "value must be a number" });
    return null;
  }
  return v;
}

// SSE endpoint
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (ALLOW_ORIGIN) res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);

  res.flushHeaders?.();

  // Send initial state
  res.write(`event: init\ndata: ${JSON.stringify(data)}\n\n`);

  // Keep-alive heartbeat
  const hb = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  clients.add(res);

  req.on("close", () => {
    clearInterval(hb);
    clients.delete(res);
  });
});

// Update routes
app.post("/soil_moisture", (req, res) => {
  const v = readNumber(req, res);
  if (v === null) return;
  data.soil_moisture = v;
  broadcast();
  res.json({ ok: true });
});

app.post("/temperature", (req, res) => {
  const v = readNumber(req, res);
  if (v === null) return;
  data.temperature = v;
  broadcast();
  res.json({ ok: true });
});

app.post("/diameter", (req, res) => {
  const v = readNumber(req, res);
  if (v === null) return;
  data.diameter = v;
  broadcast();
  res.json({ ok: true });
});

// Health check for platforms
app.get("/healthz", (req, res) => res.json({ ok: true }));

// SPA fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Start
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
