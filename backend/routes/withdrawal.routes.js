const express = require("express");
const {
  getWallet,
  requestWithdrawal,
  getWithdrawalHistory,
} = require("../controllers/withdrawal.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireFields } = require("../middleware/validation.middleware");

const router = express.Router();

router.get("/wallet", requireAuth, getWallet);
router.get("/history", requireAuth, getWithdrawalHistory);
router.post("/request", requireAuth, requireFields(["points", "upiId"]), requestWithdrawal);

module.exports = router;
