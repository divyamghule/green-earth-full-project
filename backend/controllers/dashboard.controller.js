const path = require("path");

const { readJson } = require("../utils/fileStore");

const USERS_FILE = path.join(__dirname, "..", "db", "users.json");
const ACTIVITIES_FILE = path.join(__dirname, "..", "db", "activities.json");
const POINTS_FILE = path.join(__dirname, "..", "db", "points.json");

async function getSummary(req, res) {
  const [users, activities, pointsLedger] = await Promise.all([
    readJson(USERS_FILE, []),
    readJson(ACTIVITIES_FILE, []),
    readJson(POINTS_FILE, []),
  ]);

  const user = users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const userActivities = activities.filter((item) => item.userId === req.user.id);
  const verified = userActivities.filter((item) => item.status === "Verified").length;
  const rejected = userActivities.filter((item) => item.status === "Rejected").length;

  const byType = userActivities.reduce((acc, item) => {
    acc[item.activityType] = (acc[item.activityType] || 0) + 1;
    return acc;
  }, {});

  const recentPoints = pointsLedger
    .filter((entry) => entry.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      totalPoints: user.totalPoints || 0,
      level: user.level || "Eco Starter",
      streak: user.streak || 0,
      joinedAt: user.createdAt,
    },
    stats: {
      totalSubmissions: userActivities.length,
      verifiedSubmissions: verified,
      rejectedSubmissions: rejected,
      byType,
    },
    recentPoints,
  });
}

module.exports = {
  getSummary,
};
