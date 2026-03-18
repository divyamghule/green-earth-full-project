function requireFields(fields = []) {
  return (req, res, next) => {
    const missing = fields.filter((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "");
    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }
    return next();
  };
}

function validateActivityType(req, res, next) {
  const allowed = ["garbage_cleaning", "tree_plantation", "river_cleaning", "pothole_fixing"];
  const { activityType } = req.body;
  if (!allowed.includes(activityType)) {
    return res.status(400).json({
      message: "Invalid activity type selected.",
      allowed,
    });
  }
  return next();
}

module.exports = {
  requireFields,
  validateActivityType,
};
