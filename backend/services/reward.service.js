const ACTIVITY_POINTS = {
  garbage_cleaning: 35,
  tree_plantation: 50,
  river_cleaning: 45,
  pothole_fixing: 60,
};

function calculatePoints({ activityType, confidence, streak = 0 }) {
  const basePoints = ACTIVITY_POINTS[activityType] || 20;
  const confidenceBonus = Math.round((Math.max(0, confidence - 0.75) * 100) / 2);
  const streakBonus = streak > 0 && streak % 5 === 0 ? 20 : 0;
  const total = basePoints + confidenceBonus + streakBonus;

  return {
    basePoints,
    confidenceBonus,
    streakBonus,
    total,
  };
}

function levelFromPoints(totalPoints) {
  if (totalPoints >= 1000) return "Earth Guardian";
  if (totalPoints >= 600) return "Green Leader";
  if (totalPoints >= 300) return "Eco Warrior";
  if (totalPoints >= 100) return "Nature Helper";
  return "Eco Starter";
}

module.exports = {
  ACTIVITY_POINTS,
  calculatePoints,
  levelFromPoints,
};
