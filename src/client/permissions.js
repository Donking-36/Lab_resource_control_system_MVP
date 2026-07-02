(function initPermissions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LabPermissions = api;
})(typeof globalThis !== "undefined" ? globalThis : self, function createPermissions() {
  const roleLabels = { student: "轮转生", mentor: "导师", admin: "管理员" };
  const capabilities = {
    student: new Set(["request:create", "sandbox:manage"]),
    mentor: new Set(["rotation:manage", "evaluation:save"]),
    admin: new Set([
      "request:create",
      "request:review",
      "schedule:run",
      "sandbox:manage",
      "rotation:manage",
      "evaluation:save",
      "audit:view",
    ]),
  };

  function can(user, capability) {
    return Boolean(user && capabilities[user.role]?.has(capability));
  }

  function roleLabel(role) {
    return roleLabels[role] || "访客";
  }

  return { can, capabilities, roleLabel, roleLabels };
});
