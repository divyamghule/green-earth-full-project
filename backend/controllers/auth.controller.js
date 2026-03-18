const path = require("path");
const bcrypt = require("bcryptjs");

const { readJson, writeJson } = require("../utils/fileStore");
const { signToken } = require("../utils/jwt");
const { createId } = require("../services/hash.service");
const { levelFromPoints } = require("../services/reward.service");

const USERS_FILE = path.join(__dirname, "..", "db", "users.json");

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters long.",
    });
  }

  const users = await readJson(USERS_FILE, []);
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(409).json({
      message: "Email already registered.",
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: createId("user"),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    totalPoints: 0,
    level: "Eco Starter",
    streak: 0,
    lastActivityDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeJson(USERS_FILE, users);

  const token = signToken({ userId: newUser.id, email: newUser.email });

  return res.status(201).json({
    message: "Registration successful.",
    token,
    user: sanitizeUser(newUser),
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      message: "email and password are required",
    });
  }

  const users = await readJson(USERS_FILE, []);
  const user = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  user.updatedAt = new Date().toISOString();
  user.level = levelFromPoints(user.totalPoints || 0);
  await writeJson(USERS_FILE, users);

  const token = signToken({ userId: user.id, email: user.email });

  return res.json({
    message: "Login successful.",
    token,
    user: sanitizeUser(user),
  });
}

async function me(req, res) {
  const users = await readJson(USERS_FILE, []);
  const user = users.find((u) => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.level = levelFromPoints(user.totalPoints || 0);
  await writeJson(USERS_FILE, users);

  return res.json({ user: sanitizeUser(user) });
}

module.exports = {
  register,
  login,
  me,
};
