const POINT_TO_RUPEE_RATE = Math.max(1, Number(process.env.POINT_TO_RUPEE_RATE || 1));
const MIN_WITHDRAW_POINTS = Math.max(100, Number(process.env.MIN_WITHDRAW_POINTS || 1000));

function pointsToRupees(points) {
  return Math.max(0, Number(points || 0)) * POINT_TO_RUPEE_RATE;
}

function normalizeWithdrawPoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function validateWithdrawRequest(points, availablePoints) {
  const normalized = normalizeWithdrawPoints(points);

  if (normalized === null || normalized <= 0) {
    return {
      valid: false,
      message: "Withdrawal points must be a positive number.",
    };
  }

  if (normalized < MIN_WITHDRAW_POINTS) {
    return {
      valid: false,
      message: `Minimum withdrawal is ${MIN_WITHDRAW_POINTS} points.`,
    };
  }

  if (normalized > Number(availablePoints || 0)) {
    return {
      valid: false,
      message: "Insufficient points for this withdrawal.",
    };
  }

  return {
    valid: true,
    points: normalized,
    rupees: pointsToRupees(normalized),
  };
}

module.exports = {
  POINT_TO_RUPEE_RATE,
  MIN_WITHDRAW_POINTS,
  pointsToRupees,
  validateWithdrawRequest,
};
