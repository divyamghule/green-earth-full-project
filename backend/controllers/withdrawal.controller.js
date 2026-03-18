const path = require("path");

const { readJson, writeJson } = require("../utils/fileStore");
const { createId } = require("../services/hash.service");
const { levelFromPoints } = require("../services/reward.service");
const {
  MIN_WITHDRAW_POINTS,
  POINT_TO_RUPEE_RATE,
  pointsToRupees,
  validateWithdrawRequest,
} = require("../services/withdrawal.service");

const USERS_FILE = path.join(__dirname, "..", "db", "users.json");
const POINTS_FILE = path.join(__dirname, "..", "db", "points.json");
const WITHDRAWALS_FILE = path.join(__dirname, "..", "db", "withdrawals.json");

async function getWallet(req, res) {
  const [users, withdrawals] = await Promise.all([
    readJson(USERS_FILE, []),
    readJson(WITHDRAWALS_FILE, []),
  ]);

  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const userWithdrawals = withdrawals
    .filter((item) => item.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingAmount = userWithdrawals
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + Number(item.rupees || 0), 0);

  const paidAmount = userWithdrawals
    .filter((item) => item.status === "Paid")
    .reduce((sum, item) => sum + Number(item.rupees || 0), 0);

  return res.json({
    wallet: {
      points: Number(user.totalPoints || 0),
      rupeesEquivalent: pointsToRupees(user.totalPoints || 0),
      minWithdrawPoints: MIN_WITHDRAW_POINTS,
      pointToRupeeRate: POINT_TO_RUPEE_RATE,
      canWithdraw: Number(user.totalPoints || 0) >= MIN_WITHDRAW_POINTS,
      pendingRupees: Number(pendingAmount.toFixed(2)),
      paidRupees: Number(paidAmount.toFixed(2)),
    },
    recentWithdrawals: userWithdrawals.slice(0, 20),
  });
}

async function requestWithdrawal(req, res) {
  const { points, upiId } = req.body;

  if (!upiId || String(upiId).trim().length < 3) {
    return res.status(400).json({ message: "Valid UPI ID is required for withdrawal." });
  }

  const [users, pointsLedger, withdrawals] = await Promise.all([
    readJson(USERS_FILE, []),
    readJson(POINTS_FILE, []),
    readJson(WITHDRAWALS_FILE, []),
  ]);

  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const pending = withdrawals.find((item) => item.userId === user.id && item.status === "Pending");
  if (pending) {
    return res.status(409).json({
      message: "You already have a pending withdrawal request. Please wait for completion.",
    });
  }

  const validation = validateWithdrawRequest(points, user.totalPoints || 0);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  const nowIso = new Date().toISOString();
  const pointsToWithdraw = validation.points;
  const rupeesToWithdraw = validation.rupees;
  const balanceBefore = Number(user.totalPoints || 0);
  const balanceAfter = balanceBefore - pointsToWithdraw;

  const withdrawal = {
    id: createId("wd"),
    userId: user.id,
    points: pointsToWithdraw,
    rupees: rupeesToWithdraw,
    pointToRupeeRate: POINT_TO_RUPEE_RATE,
    upiId: String(upiId).trim(),
    status: "Pending",
    createdAt: nowIso,
    updatedAt: nowIso,
    balanceBefore,
    balanceAfter,
    adminNote: null,
  };

  user.totalPoints = balanceAfter;
  user.level = levelFromPoints(user.totalPoints);
  user.updatedAt = nowIso;

  withdrawals.push(withdrawal);

  pointsLedger.push({
    id: createId("pts"),
    userId: user.id,
    activityId: null,
    points: -pointsToWithdraw,
    reason: `withdrawal requested (${withdrawal.id})`,
    createdAt: nowIso,
    balanceAfter: user.totalPoints,
    meta: {
      type: "withdrawal",
      withdrawalId: withdrawal.id,
      rupees: rupeesToWithdraw,
      status: "Pending",
    },
  });

  await Promise.all([
    writeJson(USERS_FILE, users),
    writeJson(POINTS_FILE, pointsLedger),
    writeJson(WITHDRAWALS_FILE, withdrawals),
  ]);

  return res.status(201).json({
    message: `Withdrawal request created. ${pointsToWithdraw} points = Rs ${rupeesToWithdraw}.`,
    withdrawal,
    wallet: {
      points: user.totalPoints,
      rupeesEquivalent: pointsToRupees(user.totalPoints),
      minWithdrawPoints: MIN_WITHDRAW_POINTS,
      canWithdraw: Number(user.totalPoints || 0) >= MIN_WITHDRAW_POINTS,
    },
  });
}

async function getWithdrawalHistory(req, res) {
  const withdrawals = await readJson(WITHDRAWALS_FILE, []);

  const userWithdrawals = withdrawals
    .filter((item) => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({
    count: userWithdrawals.length,
    withdrawals: userWithdrawals,
  });
}

module.exports = {
  getWallet,
  requestWithdrawal,
  getWithdrawalHistory,
};
