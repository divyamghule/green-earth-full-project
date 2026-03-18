const express = require("express");
const {
  getActivityTypes,
  createSession,
  submitActivity,
  getHistory,
} = require("../controllers/activity.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireFields, validateActivityType } = require("../middleware/validation.middleware");
const { antiFraudChecks } = require("../middleware/antiFraud.middleware");

const router = express.Router();

router.get("/types", requireAuth, getActivityTypes);
router.post("/capture-session", requireAuth, createSession);
router.post(
  "/submit",
  requireAuth,
  requireFields([
    "activityType",
    "beforeImageData",
    "afterImageData",
    "captureSessionId",
    "beforeCaptureTimestamp",
    "afterCaptureTimestamp",
    "beforeLocation",
    "afterLocation",
    "source",
  ]),
  validateActivityType,
  antiFraudChecks,
  submitActivity
);
router.get("/history", requireAuth, getHistory);

module.exports = router;
