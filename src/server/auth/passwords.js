const crypto = require("node:crypto");

const KEY_LENGTH = 64;
const DEFAULT_COST = 16384; // scrypt N; 128 * N * r(8) ≈ 16MB, under the default maxmem.

function hashPassword(password, saltInput) {
  const salt = saltInput || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, KEY_LENGTH, { N: DEFAULT_COST }).toString("hex");
  return `scrypt$${DEFAULT_COST}$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(cost) || !salt || !expectedHex) return false;

  let derived;
  try {
    derived = crypto.scryptSync(String(password), salt, expectedHex.length / 2, { N: cost });
  } catch {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
