const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/auth.routes");
const activityRoutes = require("./routes/activity.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();
const PORT = process.env.PORT || 5000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "GreenEarn Backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/dashboard", dashboardRoutes);

const frontendDir = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`GreenEarn backend running on http://localhost:${PORT}`);
});
