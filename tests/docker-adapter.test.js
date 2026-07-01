const assert = require("node:assert/strict");

const { createDockerAdapter } = require("../src/server/adapters/docker");
const { HttpError } = require("../src/server/errors");

function createAdapter() {
  return createDockerAdapter({
    containerPort: 8888,
    imageTemplates: {
      "busybox-demo": "busybox:latest",
      "pytorch-demo": "pytorch/pytorch:demo",
    },
    HttpError,
  });
}

{
  const docker = createAdapter();
  assert.equal(docker.resolveDockerImage("busybox-demo"), "busybox:latest");
  assert.equal(docker.resolveDockerImage("custom/image:1"), "custom/image:1");
  assert.equal(docker.isLightweightDemoImage("busybox-demo"), true);
  assert.equal(docker.isLightweightDemoImage("busybox:latest"), true);
  assert.equal(docker.isLightweightDemoImage("pytorch-demo"), false);
  assert.deepEqual(docker.dockerCommandForImage("busybox-demo"), ["sleep", "3600"]);
  assert.deepEqual(docker.dockerCommandForImage("pytorch-demo"), ["sh", "-lc", "sleep infinity"]);
  assert.equal(docker.makeContainerName(12), "lab-rot-12");
}

{
  const docker = createAdapter();
  assert.match(docker.normalizeMountPath("."), /Lab_resource_control_system_MVP$/);
}

{
  const docker = createAdapter();
  assert.equal(
    docker.dockerErrorMessage({ message: "spawn docker ENOENT" }),
    "未检测到 Docker CLI，请先安装 Docker 并确保 docker 命令在 PATH 中可用。",
  );
  assert.equal(docker.dockerErrorMessage({ stderr: Buffer.from("daemon unavailable\n") }), "daemon unavailable");
  assert.equal(docker.dockerErrorMessage({ stdout: Buffer.from("stdout error\n") }), "stdout error");
}

{
  const docker = createAdapter();
  assert.throws(
    () => docker.assertMountPath("/path/that/does/not/exist"),
    (error) => error instanceof HttpError && error.status === 409 && /数据集挂载路径不存在/.test(error.message),
  );
}

{
  const docker = createAdapter();
  assert.equal(docker.inspectContainerStatus(""), "未创建");
}

console.log("Docker adapter tests passed");
