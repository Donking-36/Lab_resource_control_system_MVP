const assert = require("node:assert/strict");
const { can, roleLabel } = require("../src/client/permissions");

const student = { role: "student" };
const mentor = { role: "mentor" };
const admin = { role: "admin" };

assert.equal(can(null, "request:create"), false);
assert.equal(can(student, "request:create"), true);
assert.equal(can(student, "request:review"), false);
assert.equal(can(student, "sandbox:manage"), true);
assert.equal(can(mentor, "rotation:manage"), true);
assert.equal(can(mentor, "sandbox:manage"), false);
assert.equal(can(admin, "audit:view"), true);
assert.equal(can(admin, "schedule:run"), true);
assert.equal(roleLabel("student"), "轮转生");
assert.equal(roleLabel("unknown"), "访客");

console.log("Client permission tests passed");
