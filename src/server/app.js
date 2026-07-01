const { URL } = require("node:url");

function createApp({ handleApi, serveStatic, HttpError, json }) {
  return async function handleRequest(req, res) {
    let pathname = "";
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      pathname = url.pathname;
      if (pathname.startsWith("/api/")) {
        await handleApi(req, res, pathname);
        return;
      }
      if (req.method !== "GET") throw new HttpError(405, "方法不允许");
      serveStatic(req, res, pathname);
    } catch (error) {
      const status = error.status || 500;
      if (pathname.startsWith("/api/")) {
        json(res, status, { error: error.message || "服务器错误" });
        return;
      }
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.message || "服务器错误");
    }
  };
}

module.exports = {
  createApp,
};
