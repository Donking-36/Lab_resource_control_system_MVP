const assert = require("node:assert/strict");
const path = require("node:path");

const apiPath = path.resolve(__dirname, "../src/client/api.js");

function loadApi(fetchRef) {
  delete require.cache[apiPath];
  globalThis.fetch = fetchRef;
  return require(apiPath);
}

function createResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    headers: { get: () => "request-from-header" },
    async json() {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

(async () => {
  try {
    {
      const calls = [];
      const api = loadApi(async (url, options) => {
        calls.push({ url, options });
        return createResponse({ body: { ok: true } });
      });

      const data = await api.apiRequest("/api/state", {
        method: "POST",
        headers: { "X-Test": "yes" },
        body: "{}",
      });

      assert.deepEqual(data, { ok: true });
      assert.equal(calls[0].url, "/api/state");
      assert.deepEqual(calls[0].options.headers, {
        "Content-Type": "application/json",
        "X-Test": "yes",
      });
      assert.equal(calls[0].options.method, "POST");
      assert.equal(calls[0].options.body, "{}");
      assert.equal(calls[0].options.credentials, "same-origin");
    }

    {
      const api = loadApi(async () =>
        createResponse({ ok: false, status: 409, body: { error: "业务冲突", code: "CONFLICT", requestId: "req-7" } }),
      );
      await assert.rejects(
        () => api.apiRequest("/api/conflict"),
        (error) => error.message === "业务冲突" && error.status === 409 && error.code === "CONFLICT" && error.requestId === "req-7",
      );
    }

    {
      const api = loadApi(async () => createResponse({ ok: false, status: 500, body: new Error("invalid json") }));
      await assert.rejects(() => api.apiRequest("/api/error"), /请求失败：500/);
    }

    {
      const calls = [];
      const api = loadApi(async (url, options) => {
        calls.push({ url, options });
        return createResponse({ body: { user: { role: "admin" } } });
      });
      await api.getCurrentUser();
      await api.login("admin", "secret");
      await api.logout();
      assert.deepEqual(calls.map((call) => call.url), ["/api/auth/me", "/api/auth/login", "/api/auth/logout"]);
      assert.deepEqual(JSON.parse(calls[1].options.body), { username: "admin", password: "secret" });
    }

    {
      const api = loadApi(async () => createResponse({ body: { requests: [] } }));
      const calls = [];
      await api.loadState({
        updateState(data) {
          calls.push({ name: "updateState", data });
        },
        renderAll() {
          calls.push({ name: "renderAll" });
        },
      });

      assert.deepEqual(calls, [
        { name: "updateState", data: { requests: [] } },
        { name: "renderAll" },
      ]);
    }

    {
      const api = loadApi(async () => createResponse({ body: { algorithmVersion: "xfs-v1", results: {} } }));
      const calls = [];
      await api.loadAlgorithmReport({
        updateState(data) { calls.push(data); },
        renderAll() { calls.push("render"); },
      });
      assert.deepEqual(calls, [{ algorithmReport: { algorithmVersion: "xfs-v1", results: {} } }, "render"]);
    }

    {
      const api = loadApi(async () => createResponse({ body: { saved: true } }));
      const calls = [];
      const data = await api.mutate(
        "/api/evaluations",
        { method: "POST" },
        {
          updateState(next) {
            calls.push({ name: "updateState", data: next });
          },
          renderAll() {
            calls.push({ name: "renderAll" });
          },
        },
      );

      assert.deepEqual(data, { saved: true });
      assert.deepEqual(calls, [
        { name: "updateState", data: { saved: true } },
        { name: "renderAll" },
      ]);
    }

    console.log("Client API tests passed");
  } finally {
    delete require.cache[apiPath];
    delete globalThis.fetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
