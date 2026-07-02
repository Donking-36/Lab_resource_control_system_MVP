const COOKIE_NAME = "lab_session";

function createAuthHandler({ auth, readJson, json, setCookie, HttpError, cookieSecure = false }) {
  return async function handleAuth(req, res, pathname, context = {}) {
    if (req.method === "POST" && pathname === "/api/auth/login") {
      const body = await readJson(req);
      const result = auth.login({ username: body.username, password: body.password });
      setCookie(res, COOKIE_NAME, result.token, {
        maxAge: result.maxAgeSeconds,
        httpOnly: true,
        sameSite: "Strict",
        secure: cookieSecure,
      });
      json(res, 200, { user: result.user });
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/logout") {
      auth.logout(context.token);
      setCookie(res, COOKIE_NAME, "", { maxAge: 0, httpOnly: true, sameSite: "Strict", secure: cookieSecure });
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/auth/me") {
      json(res, 200, { user: context.user || null });
      return;
    }

    throw new HttpError(404, "接口不存在");
  };
}

module.exports = {
  createAuthHandler,
  COOKIE_NAME,
};
