const assert = require("node:assert/strict");

const { hashPassword, verifyPassword } = require("../src/server/auth/passwords");

const stored = hashPassword("correct horse battery");
assert.match(stored, /^scrypt\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);

assert.ok(verifyPassword("correct horse battery", stored));
assert.ok(!verifyPassword("wrong password", stored));

// Malformed / empty stored hashes must never verify.
assert.ok(!verifyPassword("x", "garbage"));
assert.ok(!verifyPassword("x", ""));
assert.ok(!verifyPassword("x", "scrypt$16384$00$00"));

// Random salt makes each hash distinct even for the same password.
assert.notEqual(hashPassword("same"), hashPassword("same"));

console.log("Password tests passed");
