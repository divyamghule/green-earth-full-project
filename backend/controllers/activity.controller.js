const fs = require("fs/promises");
const path = require("path");

const { readJson, writeJson } = require("../utils/fileStore");
const { createCaptureSession, validateCaptureSession, consumeCaptureSession, SESSION_TTL_MS } = require("../services/captureSession.service");
const { validateLocation, calculateDistanceMeters, MAX_BEFORE_AFTER_DISTANCE_METERS } = require("../services/gps.service");
const { analyzeBeforeAfterActivity } = require("../services/ai.service");
const { calculatePoints, levelFromPoints } = require("../services/reward.service");
const { sha256, createId } = require("../services/hash.service");

const USERS_FILE = path.join(__dirname, "..", "db", "users.json");
const ACTIVITIES_FILE = path.join(__dirname, "..", "db", "activities.json");
const POINTS_FILE = path.join(__dirname, "..", "db", "points.json");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const ACTIVITY_TYPES = [
  {
    id: "garbage_cleaning",
    name: "Garbage Cleaning",
    description: "Capture before and after cleanup proof.",
  },
  {
    id: "tree_plantation",
    name: "Tree Plantation",
    description: "Capture ground before planting and after plantation.",
  },
  {
    id: "river_cleaning",
    name: "River Cleaning",
    description: "Capture riverbank before and after cleaning.",
  },
  {
    id: "pothole_fixing",
    name: "Pothole Fixing",
    description: "Capture road before and after pothole repair.",
  },
];

function stripDataUrlPrefix(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid data URL");
  }
  return {
    meta: parts[0],
    data: parts[1],
  };
}

function mimeToExt(meta) {
  if (meta.includes("image/png")) return "png";
  if (meta.includes("image/webp")) return "webp";
  if (meta.includes("image/jpeg") || meta.includes("image/jpg")) return "jpg";
  return "bin";
}

async function saveDataUrl(dataUrl, prefix) {
  const { meta, data } = stripDataUrlPrefix(dataUrl);
  const ext = mimeToExt(meta);
  const buffer = Buffer.from(data, "base64");

  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const fileName = `${prefix}_${Date.now()}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  return {
    buffer,
    fileName,
    filePath,
    publicUrl: `/uploads/${fileName}`,
    bytes: buffer.length,
  };
}

function sameUtcDate(aIso, bIso) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function yesterdayUtcDate(baseIso) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

function findDuplicateByHash(activities, hash) {
  return activities.find((item) => {
    const hashes = [item.imageHash, item.beforeImageHash, item.afterImageHash].filter(Boolean);
    return hashes.includes(hash);
  });
}

async function getActivityTypes(_req, res) {
  return res.json({
    activities: ACTIVITY_TYPES,
  });
}

async function createSession(req, res) {
  const session = createCaptureSession(req.user.id);
  return res.status(201).json({
    captureSessionId: session.id,
    expiresInMs: SESSION_TTL_MS,
  });
}

async function submitActivity(req, res) {
  const {
    activityType,
    beforeImageData,
    afterImageData,
    beforeLocation,
    afterLocation,
    captureSessionId,
    beforeCaptureTimestamp,
    afterCaptureTimestamp,
  } = req.body;

  const sessionCheck = validateCaptureSession(captureSessionId, req.user.id);
  if (!sessionCheck.valid) {
    return res.status(400).json({ message: sessionCheck.reason });
  }

  const beforeLocationCheck = validateLocation(beforeLocation);
  if (!beforeLocationCheck.valid) {
    consumeCaptureSession(captureSessionId);
    return res.status(400).json({ message: `Before location invalid: ${beforeLocationCheck.reason}` });
  }

  const afterLocationCheck = validateLocation(afterLocation);
  if (!afterLocationCheck.valid) {
    consumeCaptureSession(captureSessionId);
    return res.status(400).json({ message: `After location invalid: ${afterLocationCheck.reason}` });
  }

  const beforeAfterDistanceMeters = calculateDistanceMeters(
    beforeLocationCheck.normalized,
    afterLocationCheck.normalized
  );

  if (beforeAfterDistanceMeters > MAX_BEFORE_AFTER_DISTANCE_METERS) {
    consumeCaptureSession(captureSessionId);
    return res.status(400).json({
      message: `Before/after GPS difference too high (${Math.round(
        beforeAfterDistanceMeters
      )}m). Max allowed is ${MAX_BEFORE_AFTER_DISTANCE_METERS}m.`,
    });
  }

  let beforeImageFile;
  let afterImageFile;
  try {
    beforeImageFile = await saveDataUrl(beforeImageData, `before_${req.user.id}`);
    afterImageFile = await saveDataUrl(afterImageData, `after_${req.user.id}`);
  } catch (_error) {
    consumeCaptureSession(captureSessionId);
    return res.status(400).json({ message: "Invalid before/after image payload." });
  }

  const beforeImageHash = sha256(beforeImageFile.buffer);
  const afterImageHash = sha256(afterImageFile.buffer);

  if (beforeImageHash === afterImageHash) {
    consumeCaptureSession(captureSessionId);
    return res.status(400).json({
      message: "Before and after images are identical. Please capture real progress.",
    });
  }

  const [users, activities, pointsLedger] = await Promise.all([
    readJson(USERS_FILE, []),
    readJson(ACTIVITIES_FILE, []),
    readJson(POINTS_FILE, []),
  ]);

  const beforeDuplicate = findDuplicateByHash(activities, beforeImageHash);
  const afterDuplicate = findDuplicateByHash(activities, afterImageHash);
  if (beforeDuplicate || afterDuplicate) {
    consumeCaptureSession(captureSessionId);
    return res.status(409).json({
      message: "Duplicate proof detected. Please submit new real-time before/after captures.",
    });
  }

  let aiAnalysis;
  try {
    aiAnalysis = await analyzeBeforeAfterActivity(activityType, beforeImageFile.buffer, afterImageFile.buffer);
  } catch (error) {
    consumeCaptureSession(captureSessionId);
    return res.status(500).json({
      message: "AI before/after verification failed. Try again.",
      error: error.message,
    });
  }

  const nowIso = new Date().toISOString();
  const activityRecord = {
    id: createId("act"),
    userId: req.user.id,
    activityType,
    source: "live_camera",
    captureSessionId,
    captureTimestamps: {
      before: beforeCaptureTimestamp,
      after: afterCaptureTimestamp,
    },
    beforeImageUrl: beforeImageFile.publicUrl,
    afterImageUrl: afterImageFile.publicUrl,
    beforeImageHash,
    afterImageHash,
    locations: {
      before: beforeLocationCheck.normalized,
      after: afterLocationCheck.normalized,
      distanceMeters: Number(beforeAfterDistanceMeters.toFixed(2)),
    },
    aiResult: {
      className: aiAnalysis.afterPrediction.className,
      confidence: aiAnalysis.confidenceScore,
      beforePrediction: aiAnalysis.beforePrediction,
      afterPrediction: aiAnalysis.afterPrediction,
      changeScore: aiAnalysis.changeScore,
      minChangeScore: aiAnalysis.minChangeScore,
      minConfidence: aiAnalysis.minConfidence,
      reason: aiAnalysis.reason,
      verificationDetails: aiAnalysis.verificationDetails || null,
      mode: aiAnalysis.mode,
    },
    status: aiAnalysis.valid ? "Verified" : "Rejected",
    pointsAwarded: 0,
    rejectionReason: aiAnalysis.valid ? null : aiAnalysis.reason,
    createdAt: nowIso,
  };

  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    consumeCaptureSession(captureSessionId);
    return res.status(404).json({ message: "User not found" });
  }

  if (aiAnalysis.valid) {
    if (user.lastActivityDate) {
      if (sameUtcDate(user.lastActivityDate, nowIso)) {
        user.streak = user.streak || 1;
      } else if (sameUtcDate(yesterdayUtcDate(nowIso), user.lastActivityDate)) {
        user.streak = (user.streak || 0) + 1;
      } else {
        user.streak = 1;
      }
    } else {
      user.streak = 1;
    }

    const pointCalc = calculatePoints({
      activityType,
      confidence: aiAnalysis.confidenceScore,
      streak: user.streak,
    });

    user.totalPoints = (user.totalPoints || 0) + pointCalc.total;
    user.level = levelFromPoints(user.totalPoints);
    user.lastActivityDate = nowIso;
    user.updatedAt = nowIso;

    activityRecord.pointsAwarded = pointCalc.total;
    activityRecord.pointBreakdown = pointCalc;

    pointsLedger.push({
      id: createId("pts"),
      userId: user.id,
      activityId: activityRecord.id,
      points: pointCalc.total,
      reason: `${activityType} before/after verified`,
      createdAt: nowIso,
      balanceAfter: user.totalPoints,
    });
  } else {
    user.updatedAt = nowIso;
  }

  activities.push(activityRecord);

  await Promise.all([
    writeJson(USERS_FILE, users),
    writeJson(ACTIVITIES_FILE, activities),
    writeJson(POINTS_FILE, pointsLedger),
  ]);

  consumeCaptureSession(captureSessionId);

  const failureReason = aiAnalysis.valid
    ? null
    : activityRecord.rejectionReason || aiAnalysis.reason || "Verification failed.";

  return res.status(201).json({
    message: aiAnalysis.valid
      ? "Activity verified by before/after AI check and points awarded."
      : `Activity submitted but before/after verification failed: ${failureReason}`,
    failureReason,
    activity: activityRecord,
    user: {
      id: user.id,
      name: user.name,
      totalPoints: user.totalPoints,
      level: user.level,
      streak: user.streak,
    },
  });
}

async function getHistory(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const activities = await readJson(ACTIVITIES_FILE, []);

  const userActivities = activities
    .filter((item) => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return res.json({
    count: userActivities.length,
    activities: userActivities,
  });
}

module.exports = {
  getActivityTypes,
  createSession,
  submitActivity,
  getHistory,
};
