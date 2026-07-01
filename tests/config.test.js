const assert = require("node:assert/strict");
const path = require("node:path");

const { createConfig } = require("../src/server/config");

{
  const root = path.join("tmp", "lab-project");
  const config = createConfig({}, root);

  assert.equal(config.ROOT, root);
  assert.equal(config.DATA_DIR, path.join(root, "data"));
  assert.equal(config.DB_PATH, path.join(root, "data", "lab_resource.db"));
  assert.equal(config.PORT, 3000);
  assert.equal(config.CONTAINER_PORT, 8888);
  assert.equal(config.IMAGE_TEMPLATES["busybox-demo"], "busybox:latest");
}

{
  const config = createConfig(
    {
      LAB_MVP_DB: "/tmp/custom.db",
      PORT: "3130",
      LAB_CONTAINER_PORT: "8899",
    },
    "/repo",
  );

  assert.equal(config.DB_PATH, "/tmp/custom.db");
  assert.equal(config.PORT, 3130);
  assert.equal(config.CONTAINER_PORT, 8899);
}

{
  const first = createConfig({}, "/repo");
  const second = createConfig({}, "/repo");

  first.IMAGE_TEMPLATES["busybox-demo"] = "changed";
  assert.equal(second.IMAGE_TEMPLATES["busybox-demo"], "busybox:latest");
}

console.log("Config tests passed");
