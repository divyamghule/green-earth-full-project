const express = require("express");
const { getSummary } = require("../controllers/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/summary", requireAuth, getSummary);

module.exports = router;
