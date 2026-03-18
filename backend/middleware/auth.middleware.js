const { verifyToken } = require("../utils/jwt");
const path = require("path");
const { readJson } = require("../utils/fileStore");

const USERS_FILE = path.join(__dirname, "..", "db", "users.json");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Missing auth token" });
    }

    const payload = verifyToken(token);
    const users = await readJson(USERS_FILE, []);
    const user = users.find((item) => item.id === payload.userId);

    if (!user) {
      return res.status(401).json({ message: "User does not exist" });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      totalPoints: user.totalPoints || 0,
      level: user.level || "Eco Starter",
      streak: user.streak || 0,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = {
  requireAuth,
};
