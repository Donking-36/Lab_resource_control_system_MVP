const assert = require("node:assert/strict");
const { createAuthManager } = require("../src/client/auth");

function createHarness(overrides = {}) {
  const calls = [];
  const state = {};
  const manager = createAuthManager({
    api: {
      getCurrentUser: async () => ({ user: overrides.restoredUser ?? null }),
      login: async (username, password) => ({ user: overrides.loginUser || { username, displayName: "系统管理员", role: "admin" }, password }),
      logout: async () => {
        if (overrides.logoutError) throw overrides.logoutError;
        return { ok: true };
      },
    },
    updateState(data) {
      Object.assign(state, data);
      calls.push({ name: "updateState", data });
    },
    async onAuthenticated(user) { calls.push({ name: "authenticated", user }); },
    onAnonymous() { calls.push({ name: "anonymous" }); },
    onError(error) { calls.push({ name: "error", message: error.message }); },
  });
  return { calls, manager, state };
}

(async () => {
  {
    const { manager, state, calls } = createHarness();
    assert.equal(await manager.restore(), null);
    assert.equal(state.authStatus, "anonymous");
    assert.equal(calls.at(-1).name, "anonymous");
  }

  {
    const user = { username: "lin", displayName: "林可", role: "student" };
    const { manager, state } = createHarness({ restoredUser: user });
    assert.deepEqual(await manager.restore(), user);
    assert.equal(state.authStatus, "authenticated");
    assert.deepEqual(state.user, user);
  }

  {
    const { manager, state } = createHarness();
    await assert.rejects(() => manager.login({ username: "", password: "" }), /请输入用户名和密码/);
    const user = await manager.login({ username: " admin ", password: "secret" });
    assert.equal(user.role, "admin");
    assert.equal(state.authStatus, "authenticated");
  }

  {
    const { manager, state } = createHarness({ logoutError: new Error("network down") });
    await assert.rejects(() => manager.logout(), /network down/);
    assert.equal(state.authStatus, "anonymous");
    assert.equal(state.user, null);
  }

  console.log("Client auth tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
