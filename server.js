const express = require("express");
const app = express();
const port = 3000;

let data = {
  soil_moisture: 0,
  temperature: 0,
  diameter: 0,
};

let clients = [];

// Middleware to parse JSON
app.use(express.json());
app.use(express.static(__dirname + "/public"));

// SSE endpoint — keeps connection open for updates
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter((c) => c !== res);
  });
});

// Helper to broadcast new data
function broadcast() {
  for (const client of clients) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// Routes to update data
app.post("/soil_moisture", (req, res) => {
  data.soil_moisture = req.body.value;
  broadcast();
  res.send("Soil moisture updated");
});

app.post("/temperature", (req, res) => {
  data.temperature = req.body.value;
  broadcast();
  res.send("Temperature updated");
});

app.post("/diameter", (req, res) => {
  data.diameter = req.body.value;
  broadcast();
  res.send("Diameter updated");
});

// Serve main page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
