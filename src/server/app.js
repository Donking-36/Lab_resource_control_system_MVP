const { URL } = require("node:url");
const crypto = require("node:crypto");

function createApp({
  handleApi,
  serveStatic,
  HttpError,
  json,
  handleAuth = null,
  authenticateRequest = () => ({ user: null, token: "" }),
  authorize = () => {},
  logger = null,
  generateRequestId = () => crypto.randomUUID(),
}) {
  // Cookie-based auth needs CSRF protection: reject cross-origin unsafe
  // requests. A missing Origin (server-to-server / same-origin) is allowed.
  function checkOrigin(req) {
    const origin = req.headers && req.headers.origin;
    if (!origin) return;
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new HttpError(403, "非法 Origin", "ORIGIN_INVALID");
    }
    if (originHost !== ((req.headers && req.headers.host) || "")) {
      throw new HttpError(403, "跨域请求被拒绝", "ORIGIN_MISMATCH");
    }
  }

  function log(fields) {
    if (logger) logger(fields);
  }

  return async function handleRequest(req, res) {
    const requestId = generateRequestId();
    req.requestId = requestId;
    if (typeof res.setHeader === "function") res.setHeader("X-Request-Id", requestId);
    const startedAt = Date.now();
    let pathname = "";

    try {
      const url = new URL(req.url, `http://${(req.headers && req.headers.host) || "localhost"}`);
      pathname = url.pathname;
      const isUnsafe = req.method !== "GET" && req.method !== "HEAD";

      if (pathname.startsWith("/api/")) {
        if (isUnsafe) checkOrigin(req);
        const auth = authenticateRequest(req);

        if (pathname.startsWith("/api/auth/") && handleAuth) {
          await handleAuth(req, res, pathname, { user: auth.user, token: auth.token });
        } else {
          authorize({ method: req.method, pathname, user: auth.user });
          await handleApi(req, res, pathname, { user: auth.user });
        }

        log({ requestId, method: req.method, path: pathname, status: res.statusCode, durationMs: Date.now() - startedAt });
        return;
      }

      if (req.method !== "GET") throw new HttpError(405, "方法不允许");
      serveStatic(req, res, pathname);
      log({ requestId, method: req.method, path: pathname, status: res.statusCode, durationMs: Date.now() - startedAt });
    } catch (error) {
      const status = error.status || 500;
      const code = error.code || "INTERNAL_ERROR";
      if (pathname.startsWith("/api/")) {
        json(res, status, { error: error.message || "服务器错误", code, requestId });
      } else {
        res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(error.message || "服务器错误");
      }
      log({ requestId, method: req.method, path: pathname, status, durationMs: Date.now() - startedAt, error: error.message });
    }
  };
}

module.exports = {
  createApp,
};
