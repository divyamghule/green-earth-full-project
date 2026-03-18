const fs = require("fs/promises");
const path = require("path");

const writeQueue = new Map();

async function ensureFile(filePath, defaultData) {
  try {
    await fs.access(filePath);
  } catch (_error) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2), "utf-8");
  }
}

async function readJson(filePath, defaultData) {
  await ensureFile(filePath, defaultData);
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return defaultData;
  }
}

async function writeJson(filePath, data) {
  await ensureFile(filePath, data);

  const current = writeQueue.get(filePath) || Promise.resolve();
  const next = current.then(async () => {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
  });

  writeQueue.set(filePath, next.catch(() => {}));
  return next;
}

module.exports = {
  readJson,
  writeJson,
};
