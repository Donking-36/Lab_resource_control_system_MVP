const assert = require("node:assert/strict");

const { authorize, isPublic, requiredRoles } = require("../src/server/rbac");
const { HttpError } = require("../src/server/errors");

const student = { id: 3, role: "student", displayName: "林可" };
const mentor = { id: 2, role: "mentor", displayName: "导师" };
const admin = { id: 1, role: "admin", displayName: "管理员" };

function assertStatus(status) {
  return (error) => error instanceof HttpError && error.status === status;
}

// Public routes need no session.
assert.ok(isPublic("GET", "/api/health"));
assert.ok(isPublic("POST", "/api/auth/login"));
assert.ok(isPublic("POST", "/api/auth/logout"));
authorize({ method: "GET", pathname: "/api/health", user: null });
authorize({ method: "POST", pathname: "/api/auth/login", user: null });

// Anonymous access to a business endpoint is rejected.
assert.throws(
  () => authorize({ method: "GET", pathname: "/api/state", user: null }),
  (error) => error instanceof HttpError && error.status === 401 && error.code === "UNAUTHENTICATED",
);

// Students may not approve or schedule.
assert.throws(() => authorize({ method: "POST", pathname: "/api/requests/5/approve", user: student }), assertStatus(403));
assert.throws(() => authorize({ method: "POST", pathname: "/api/schedule/next", user: student }), assertStatus(403));
authorize({ method: "POST", pathname: "/api/requests/5/approve", user: admin });
authorize({ method: "POST", pathname: "/api/schedule/next", user: admin });

// Mentors may not operate containers; students (route-level) may.
assert.throws(() => authorize({ method: "POST", pathname: "/api/sandboxes/lab-rot-7/toggle", user: mentor }), assertStatus(403));
authorize({ method: "POST", pathname: "/api/sandboxes/lab-rot-7/toggle", user: student });
authorize({ method: "DELETE", pathname: "/api/sandboxes/lab-rot-7", user: student });

// Students may not progress rotations or evaluate; mentors/admins may.
assert.throws(() => authorize({ method: "POST", pathname: "/api/rotations/3/progress", user: student }), assertStatus(403));
assert.throws(() => authorize({ method: "POST", pathname: "/api/evaluations", user: student }), assertStatus(403));
authorize({ method: "POST", pathname: "/api/rotations/3/progress", user: mentor });
authorize({ method: "POST", pathname: "/api/evaluations", user: mentor });

// Mentors may not create requests; students/admins may.
assert.throws(() => authorize({ method: "POST", pathname: "/api/requests", user: mentor }), assertStatus(403));
authorize({ method: "POST", pathname: "/api/requests", user: student });

// Any authenticated user may read state / report.
authorize({ method: "GET", pathname: "/api/state", user: student });
authorize({ method: "GET", pathname: "/api/algorithm/report", user: mentor });

assert.deepEqual(requiredRoles("POST", "/api/schedule/next"), ["admin"]);
assert.equal(requiredRoles("GET", "/api/state"), "any");

console.log("RBAC tests passed");
