const assert = require("node:assert/strict");

const { createStaticHandler, isAllowedPublicFile, toPublicPath } = require("../src/server/routes/static");

class TestHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

assert.equal(isAllowedPublicFile("index.html"), true);
assert.equal(isAllowedPublicFile("styles.css"), true);
assert.equal(isAllowedPublicFile("app.js"), true);
assert.equal(isAllowedPublicFile("src/client/api.js"), true);
assert.equal(isAllowedPublicFile("feedback-evidence/README.md"), true);
assert.equal(isAllowedPublicFile("mvp-screenshot.png"), true);
assert.equal(isAllowedPublicFile("favicon.ico"), true);

assert.equal(isAllowedPublicFile("server.js"), false);
assert.equal(isAllowedPublicFile("src/server/config.js"), false);
assert.equal(isAllowedPublicFile("tests/api.test.js"), false);
assert.equal(isAllowedPublicFile("data/lab_resource.db"), false);
assert.equal(isAllowedPublicFile(".git/config"), false);
assert.equal(isAllowedPublicFile("../package.json"), false);

assert.equal(toPublicPath("/tmp/lab/src/client/api.js", "/tmp/lab"), "src/client/api.js");

{
  const serveStatic = createStaticHandler({ root: "/tmp/lab", HttpError: TestHttpError });
  assert.throws(
    () => serveStatic({}, {}, "/%E0%A4%A"),
    (error) => error instanceof TestHttpError && error.status === 400 && error.message === "路径编码错误",
  );
}

console.log("Static route tests passed");
