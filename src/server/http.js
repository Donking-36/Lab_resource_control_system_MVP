const { HttpError } = require("./errors");

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;

    function finish(callback) {
      if (settled) return;
      settled = true;
      callback();
    }

    function fail(error, shouldDestroy = false) {
      finish(() => {
        reject(error);
        if (shouldDestroy && typeof req.destroy === "function") req.destroy();
      });
    }

    req.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (body.length > 1024 * 1024) {
        fail(new HttpError(413, "请求体过大"), true);
      }
    });
    req.on("end", () => {
      if (settled) return;
      if (!body) {
        finish(() => resolve({}));
        return;
      }
      try {
        const parsed = JSON.parse(body);
        finish(() => resolve(parsed));
      } catch {
        fail(new HttpError(400, "JSON 格式错误"));
      }
    });
    req.on("error", (error) => {
      fail(error);
    });
  });
}

function assertText(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new HttpError(400, `${field} 不能为空`);
  return text;
}

function assertNumber(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${field} 必须在 ${min}-${max} 之间`);
  }
  return Math.round(number);
}

module.exports = {
  json,
  readJson,
  assertText,
  assertNumber,
};
