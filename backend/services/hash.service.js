const crypto = require("crypto");

function sha256(bufferOrString) {
  return crypto.createHash("sha256").update(bufferOrString).digest("hex");
}

function createId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = {
  sha256,
  createId,
};
