const fs = require("node:fs");
const path = require("node:path");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const allowedRootFiles = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "README.md",
  "requirements-priority.md",
  "validation-feedback-report.md",
  "testing-deployment.md",
  "ARCHITECTURE.md",
  "后续迭代计划.md",
  "项目提交自查清单.md",
  "mvp-screenshot.png",
  "mvp-mobile.png",
  "favicon.ico",
]);
const allowedPublicDirs = ["src/client/", "feedback-evidence/"];

function toPublicPath(filePath, root) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function isAllowedPublicFile(publicPath) {
  if (!publicPath || publicPath.startsWith("../") || path.isAbsolute(publicPath)) return false;
  if (allowedRootFiles.has(publicPath)) return true;
  return allowedPublicDirs.some((dir) => publicPath.startsWith(dir));
}

function decodeRequestedPath(requested, HttpError) {
  try {
    return decodeURIComponent(requested);
  } catch {
    throw new HttpError(400, "路径编码错误");
  }
}

function createStaticHandler({ root, HttpError }) {
  return function serveStatic(req, res, pathname) {
    const requested = pathname === "/" ? "/index.html" : pathname;
    const normalized = path.normalize(decodeRequestedPath(requested, HttpError)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(root, normalized);
    if (!filePath.startsWith(root)) throw new HttpError(403, "禁止访问");
    if (!isAllowedPublicFile(toPublicPath(filePath, root))) throw new HttpError(403, "禁止访问");
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new HttpError(404, "文件不存在");

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  };
}

module.exports = {
  createStaticHandler,
  decodeRequestedPath,
  isAllowedPublicFile,
  mimeTypes,
  toPublicPath,
};
