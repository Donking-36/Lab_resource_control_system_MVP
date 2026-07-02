const assert = require("node:assert/strict");

const { createApp } = require("../src/server/app");
const { HttpError } = require("../src/server/errors");

function createResponse() {
  return {
    status: null,
    headers: null,
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

function json(res, status, payload) {
  res.status = status;
  res.headers = { "Content-Type": "application/json" };
  res.body = JSON.stringify(payload);
}

async function request(app, method, url) {
  const res = createResponse();
  await app({ method, url, headers: { host: "localhost" } }, res);
  return res;
}

(async () => {
  {
    const calls = [];
    const app = createApp({
      handleApi(req, res, pathname) {
        calls.push({ name: "handleApi", method: req.method, pathname });
        json(res, 200, { ok: true });
      },
      serveStatic() {
        calls.push({ name: "serveStatic" });
      },
      HttpError,
      json,
    });

    const res = await request(app, "GET", "/api/state?ignored=1");
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.deepEqual(calls, [{ name: "handleApi", method: "GET", pathname: "/api/state" }]);
  }

  {
    const calls = [];
    const app = createApp({
      handleApi() {
        calls.push({ name: "handleApi" });
      },
      serveStatic(req, res, pathname) {
        calls.push({ name: "serveStatic", method: req.method, pathname });
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("static ok");
      },
      HttpError,
      json,
    });

    const res = await request(app, "GET", "/index.html");
    assert.equal(res.status, 200);
    assert.equal(res.body, "static ok");
    assert.deepEqual(calls, [{ name: "serveStatic", method: "GET", pathname: "/index.html" }]);
  }

  {
    const app = createApp({
      handleApi() {},
      serveStatic() {
        throw new Error("should not be called");
      },
      HttpError,
      json,
    });

    const res = await request(app, "POST", "/index.html");
    assert.equal(res.status, 405);
    assert.equal(res.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(res.body, "方法不允许");
  }

  {
    const app = createApp({
      handleApi() {
        throw new HttpError(409, "业务冲突");
      },
      serveStatic() {},
      HttpError,
      json,
    });

    const res = await request(app, "POST", "/api/requests/1/approve");
    assert.equal(res.status, 409);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "业务冲突");
    assert.equal(body.code, "CONFLICT");
    assert.equal(typeof body.requestId, "string");
  }

  {
    const app = createApp({
      handleApi() {
        throw new HttpError(400, "绝对 URL 错误");
      },
      serveStatic() {},
      HttpError,
      json,
    });

    const res = await request(app, "GET", "http://localhost/api/state");
    assert.equal(res.status, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "绝对 URL 错误");
    assert.equal(body.code, "BAD_REQUEST");
    assert.equal(typeof body.requestId, "string");
  }

  {
    const app = createApp({
      handleApi() {},
      serveStatic() {
        throw new HttpError(403, "禁止访问");
      },
      HttpError,
      json,
    });

    const res = await request(app, "GET", "/server.js");
    assert.equal(res.status, 403);
    assert.equal(res.headers["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(res.body, "禁止访问");
  }

  console.log("Server app tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
