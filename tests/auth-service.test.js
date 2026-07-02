const assert = require("node:assert/strict");

const { createAuthService } = require("../src/server/services/auth");
const { hashPassword, verifyPassword } = require("../src/server/auth/passwords");
const { HttpError } = require("../src/server/errors");

function createFakeRepo() {
  const users = [];
  const sessions = new Map();
  let userId = 0;
  return {
    users,
    sessions,
    getUserByUsername(username) {
      return users.find((user) => user.username === username);
    },
    insertUser(user) {
      userId += 1;
      users.push({
        id: userId,
        username: user.username,
        display_name: user.displayName,
        role: user.role,
        password_hash: user.passwordHash,
        created_at: user.createdAt,
      });
      return { lastInsertRowid: userId };
    },
    createSession(session) {
      sessions.set(session.token, session);
    },
    getSession(token) {
      const session = sessions.get(token);
      if (!session) return null;
      const user = users.find((candidate) => candidate.id === session.userId);
      return {
        token,
        userId: session.userId,
        expiresAt: session.expiresAt,
        user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role },
      };
    },
    deleteSession(token) {
      sessions.delete(token);
    },
  };
}

let clock = 1000;
let tokenSeq = 0;
function makeService(repo, options = {}) {
  return createAuthService({
    repositories: repo,
    hashPassword,
    verifyPassword,
    sessionTtlMs: 1000,
    bootstrapAdminPassword: options.admin || "",
    seedTestUsers: options.seed || false,
    nowText: () => "now",
    HttpError,
    now: () => clock,
    generateToken: () => `tok${(tokenSeq += 1)}`,
  });
}

// bootstrap creates the admin and is idempotent.
{
  const repo = createFakeRepo();
  const service = makeService(repo, { admin: "secret" });
  service.bootstrap();
  service.bootstrap();
  assert.equal(repo.users.filter((user) => user.username === "admin").length, 1);
  assert.equal(repo.users[0].role, "admin");
}

// seed provisions all three roles with the fixed test student mapped to a seed name.
{
  const repo = createFakeRepo();
  const service = makeService(repo, { seed: true });
  service.bootstrap();
  assert.deepEqual(repo.users.map((user) => user.role).sort(), ["admin", "mentor", "student"]);
  assert.equal(repo.users.find((user) => user.username === "lin").display_name, "林可");
}

// login / authenticate / expiry / logout.
{
  const repo = createFakeRepo();
  const service = makeService(repo, { seed: true });
  service.bootstrap();

  assert.throws(() => service.login({ username: "lin", password: "wrong" }), (error) => error.status === 401);
  assert.throws(() => service.login({ username: "ghost", password: "x" }), (error) => error.status === 401);

  const result = service.login({ username: "lin", password: "lin-test-pass" });
  assert.equal(result.user.role, "student");
  assert.equal(result.user.displayName, "林可");
  assert.equal(service.authenticate(result.token).username, "lin");

  clock += 2000; // past the 1000ms TTL
  assert.equal(service.authenticate(result.token), null);

  clock = 1000;
  const second = service.login({ username: "lin", password: "lin-test-pass" });
  service.logout(second.token);
  assert.equal(service.authenticate(second.token), null);
  assert.equal(service.authenticate(""), null);
}

console.log("Auth service tests passed");
