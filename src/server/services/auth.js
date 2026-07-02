const crypto = require("node:crypto");

function createAuthService({
  repositories,
  hashPassword,
  verifyPassword,
  sessionTtlMs,
  bootstrapAdminPassword = "",
  seedTestUsers = false,
  nowText,
  HttpError,
  now = () => Date.now(),
  generateToken = () => crypto.randomBytes(32).toString("hex"),
}) {
  function toPublicUser(row) {
    return { id: row.id, username: row.username, displayName: row.display_name, role: row.role };
  }

  function ensureUser({ username, displayName, role, password }) {
    if (repositories.getUserByUsername(username)) return;
    repositories.insertUser({
      username,
      displayName,
      role,
      passwordHash: hashPassword(password),
      createdAt: nowText(),
    });
  }

  // First-run provisioning. Admin password comes from the environment; the
  // fixed test accounts are only created when explicitly requested.
  function bootstrap() {
    if (bootstrapAdminPassword) {
      ensureUser({ username: "admin", displayName: "系统管理员", role: "admin", password: bootstrapAdminPassword });
    }
    if (seedTestUsers) {
      ensureUser({ username: "admin", displayName: "系统管理员", role: "admin", password: "admin-test-pass" });
      ensureUser({ username: "mentor", displayName: "导师-王教授", role: "mentor", password: "mentor-test-pass" });
      ensureUser({ username: "lin", displayName: "林可", role: "student", password: "lin-test-pass" });
    }
  }

  function login({ username, password }) {
    const uname = String(username || "").trim();
    const row = uname ? repositories.getUserByUsername(uname) : null;
    // Verify against a hash even when the user is missing to keep timing uniform.
    const ok = row
      ? verifyPassword(String(password || ""), row.password_hash)
      : verifyPassword(String(password || ""), "scrypt$16384$00$00");
    if (!row || !ok) throw new HttpError(401, "用户名或密码错误", "INVALID_CREDENTIALS");

    const token = generateToken();
    const expiresAt = now() + sessionTtlMs;
    repositories.createSession({ token, userId: row.id, expiresAt, createdAt: nowText() });
    return { user: toPublicUser(row), token, expiresAt, maxAgeSeconds: Math.floor(sessionTtlMs / 1000) };
  }

  function logout(token) {
    if (token) repositories.deleteSession(token);
  }

  // Resolve a cookie token to the live user, dropping expired sessions.
  function authenticate(token) {
    if (!token) return null;
    const session = repositories.getSession(token);
    if (!session) return null;
    if (Number(session.expiresAt) <= now()) {
      repositories.deleteSession(token);
      return null;
    }
    return session.user;
  }

  return {
    bootstrap,
    login,
    logout,
    authenticate,
  };
}

module.exports = {
  createAuthService,
};
