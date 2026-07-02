const { HttpError } = require("./errors");

const ROLES = ["student", "mentor", "admin"];

// Routes reachable without a session: health probe and the auth endpoints.
function isPublic(method, pathname) {
  if (method === "GET" && pathname === "/api/health") return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout" || pathname === "/api/auth/me") return true;
  return false;
}

// Roles allowed to reach a method+path. "any" => any authenticated user
// (per-row filtering / ownership is enforced later in the service layer).
// Unknown API routes return "any" so the route handler can answer 404.
function requiredRoles(method, pathname) {
  if (method === "GET" && (pathname === "/api/state" || pathname === "/api/gpu-nodes" || pathname === "/api/algorithm/report")) {
    return "any";
  }
  if (method === "POST" && pathname === "/api/requests") return ["student", "admin"];
  if (method === "POST" && /^\/api\/requests\/\d+\/approve$/.test(pathname)) return ["admin"];
  if (method === "POST" && /^\/api\/requests\/\d+\/reject$/.test(pathname)) return ["admin"];
  if (method === "POST" && pathname === "/api/schedule/next") return ["admin"];
  if (method === "DELETE" && /^\/api\/sandboxes\/[^/]+$/.test(pathname)) return ["student", "admin"];
  if (method === "POST" && /^\/api\/sandboxes\/[^/]+\/(toggle|snapshot)$/.test(pathname)) return ["student", "admin"];
  if (method === "POST" && /^\/api\/rotations\/\d+\/(progress|remind)$/.test(pathname)) return ["mentor", "admin"];
  if (method === "POST" && pathname === "/api/evaluations") return ["mentor", "admin"];
  return "any";
}

function authorize({ method, pathname, user }) {
  if (isPublic(method, pathname)) return;
  if (!user) throw new HttpError(401, "请先登录", "UNAUTHENTICATED");
  const roles = requiredRoles(method, pathname);
  if (roles === "any") return;
  if (!roles.includes(user.role)) throw new HttpError(403, "当前角色无权执行该操作", "FORBIDDEN");
}

module.exports = {
  ROLES,
  isPublic,
  requiredRoles,
  authorize,
};
