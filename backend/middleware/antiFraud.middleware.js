function antiFraudChecks(req, res, next) {
  const {
    beforeImageData,
    afterImageData,
    source,
    beforeCaptureTimestamp,
    afterCaptureTimestamp,
  } = req.body;

  if (!beforeImageData || typeof beforeImageData !== "string" || !beforeImageData.startsWith("data:image/")) {
    return res.status(400).json({
      message: "Before image must be captured from live camera.",
    });
  }

  if (!afterImageData || typeof afterImageData !== "string" || !afterImageData.startsWith("data:image/")) {
    return res.status(400).json({
      message: "After image must be captured from live camera.",
    });
  }

  if (source !== "live_camera") {
    return res.status(400).json({
      message: "Gallery uploads are not allowed. Use live camera capture.",
    });
  }

  if (!beforeCaptureTimestamp || !afterCaptureTimestamp) {
    return res.status(400).json({
      message: "Before/after capture timestamps are required for verification.",
    });
  }

  const beforeCaptureTime = new Date(beforeCaptureTimestamp).getTime();
  const afterCaptureTime = new Date(afterCaptureTimestamp).getTime();
  if (!Number.isFinite(beforeCaptureTime) || !Number.isFinite(afterCaptureTime)) {
    return res.status(400).json({
      message: "Invalid before/after capture timestamps.",
    });
  }

  if (afterCaptureTime < beforeCaptureTime) {
    return res.status(400).json({
      message: "After capture time cannot be earlier than before capture time.",
    });
  }

  const now = Date.now();
  const beforeAgeMs = now - beforeCaptureTime;
  const afterAgeMs = now - afterCaptureTime;
  if (beforeAgeMs > 20 * 60 * 1000 || afterAgeMs > 20 * 60 * 1000) {
    return res.status(400).json({
      message: "Before/after captures are too old. Please capture again in real-time.",
    });
  }

  const pairGapMs = afterCaptureTime - beforeCaptureTime;
  if (pairGapMs > 45 * 60 * 1000) {
    return res.status(400).json({
      message: "Before and after captures are too far apart. Retry activity and recapture.",
    });
  }

  return next();
}

module.exports = {
  antiFraudChecks,
};
