const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// State
let data = { soil_moisture: 0, temperature: 0, diameter: 0 };
const clients = new Set();

// Middleware
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir, { index: false, maxAge: "1h", etag: true }));

// SSE
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: init\ndata: ${JSON.stringify(data)}\n\n`);
  const hb = setInterval(() => res.write(`event: ping\ndata: ${Date.now()}\n\n`), 25000);

  clients.add(res);
  req.on("close", () => {
    clearInterval(hb);
    clients.delete(res);
  });
});

function broadcast() {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(payload);
}

function readNumber(req, res) {
  const v = req.body?.value;
  if (typeof v !== "number" || Number.isNaN(v)) {
    res.status(400).json({ error: "value must be a number" });
    return null;
  }
  return v;
}

app.post("/soil_moisture", (req, res) => {
  const v = readNumber(req, res); if (v === null) return;
  data.soil_moisture = v; broadcast(); res.json({ ok: true });
});
app.post("/temperature", (req, res) => {
  const v = readNumber(req, res); if (v === null) return;
  data.temperature = v; broadcast(); res.json({ ok: true });
});
app.post("/diameter", (req, res) => {
  const v = readNumber(req, res); if (v === null) return;
  data.diameter = v; broadcast(); res.json({ ok: true });
});

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// SPA fallback (Express 5 safe). Must be after all API/static routes.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  // Avoid hijacking API/SSE if someone misroutes
  if (req.path.startsWith("/events")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

// Start
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
