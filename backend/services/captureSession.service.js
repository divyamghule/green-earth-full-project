const { createId } = require("./hash.service");

const sessionStore = new Map();
const SESSION_TTL_MS = 3 * 60 * 1000;

function createCaptureSession(userId) {
  const id = createId("capture");
  const now = Date.now();
  const session = {
    id,
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    used: false,
  };
  sessionStore.set(id, session);
  return session;
}

function validateCaptureSession(sessionId, userId) {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return { valid: false, reason: "Capture session not found." };
  }

  if (session.userId !== userId) {
    return { valid: false, reason: "Capture session user mismatch." };
  }

  if (session.used) {
    return { valid: false, reason: "Capture session already used." };
  }

  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return { valid: false, reason: "Capture session expired." };
  }

  return { valid: true, session };
}

function consumeCaptureSession(sessionId) {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.used = true;
    sessionStore.set(sessionId, session);
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessionStore.entries()) {
    if (session.expiresAt < now || session.used) {
      sessionStore.delete(id);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 1000).unref();

module.exports = {
  SESSION_TTL_MS,
  createCaptureSession,
  validateCaptureSession,
  consumeCaptureSession,
};
