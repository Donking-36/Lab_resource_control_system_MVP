const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function createDockerAdapter({ containerPort, imageTemplates, HttpError }) {
  function runDocker(args, options = {}) {
    return execFileSync("docker", args, {
      encoding: "utf8",
      timeout: options.timeout || 30000,
      windowsHide: true,
    }).trim();
  }

  function tryDocker(args, options = {}) {
    try {
      return { ok: true, output: runDocker(args, options) };
    } catch (error) {
      return { ok: false, error: dockerErrorMessage(error) };
    }
  }

  function dockerErrorMessage(error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const message = stderr || stdout || error.message || "Docker 命令执行失败";
    if (message.includes("not recognized") || message.includes("ENOENT") || message.includes("无法将")) {
      return "未检测到 Docker CLI，请先安装 Docker 并确保 docker 命令在 PATH 中可用。";
    }
    return message;
  }

  function getDockerHealth() {
    const version = tryDocker(["--version"], { timeout: 5000 });
    if (!version.ok) return { available: false, error: version.error };

    const server = tryDocker(["info", "--format", "{{.ServerVersion}}"], { timeout: 8000 });
    if (!server.ok) return { available: false, cli: version.output, error: server.error };

    return { available: true, cli: version.output, server: server.output };
  }

  function resolveDockerImage(image) {
    return imageTemplates[image] || image;
  }

  function isLightweightDemoImage(image) {
    return image === "busybox-demo" || image === "busybox" || image === "busybox:latest";
  }

  function dockerCommandForImage(image) {
    if (isLightweightDemoImage(image)) return ["sleep", "3600"];
    return ["sh", "-lc", "sleep infinity"];
  }

  function makeContainerName(requestId) {
    return `lab-rot-${requestId}`;
  }

  function normalizeMountPath(dataset) {
    return path.resolve(dataset);
  }

  function assertMountPath(dataset) {
    const mountPath = normalizeMountPath(dataset);
    if (!fs.existsSync(mountPath)) {
      throw new HttpError(409, `数据集挂载路径不存在：${mountPath}`);
    }
    return mountPath;
  }

  function createDockerContainer({ request, port, name }) {
    const image = resolveDockerImage(request.image);
    const mountPath = assertMountPath(request.dataset);
    const existing = tryDocker(["rm", "-f", name], { timeout: 15000 });
    if (!existing.ok && !existing.error.includes("No such container")) {
      throw new HttpError(500, existing.error);
    }

    const args = [
      "run",
      "-d",
      "--name",
      name,
      "-p",
      `${port}:${containerPort}`,
      "-v",
      `${mountPath}:/workspace/dataset:ro`,
      "-w",
      "/workspace",
    ];

    if (request.gpus > 0 && !isLightweightDemoImage(request.image)) {
      args.push("--gpus", String(request.gpus));
    }

    args.push(image, ...dockerCommandForImage(request.image));

    try {
      return {
        containerId: runDocker(args, { timeout: 120000 }),
        containerName: name,
        image,
        mountPath,
        containerPort,
      };
    } catch (error) {
      throw new HttpError(500, dockerErrorMessage(error));
    }
  }

  function inspectContainerStatus(containerId) {
    if (!containerId) return "未创建";
    const result = tryDocker(["inspect", "-f", "{{.State.Status}}", containerId], { timeout: 8000 });
    return result.ok ? result.output : "未知";
  }

  function pauseContainer(box) {
    if (!box.container_id) return;
    const result = tryDocker(["pause", box.container_id], { timeout: 15000 });
    if (!result.ok) throw new HttpError(500, result.error);
  }

  function unpauseContainer(box) {
    if (!box.container_id) return;
    const result = tryDocker(["unpause", box.container_id], { timeout: 15000 });
    if (!result.ok) throw new HttpError(500, result.error);
  }

  function removeContainer(box) {
    if (!box.container_id) return;
    const result = tryDocker(["rm", "-f", box.container_id], { timeout: 30000 });
    if (!result.ok && !result.error.includes("No such container")) {
      throw new HttpError(500, result.error);
    }
  }

  function commitContainer(box, nextVersion) {
    if (!box.container_id) return "";
    const snapshotImage = `lab-snapshot:${box.id}-${nextVersion}`;
    const result = tryDocker(["commit", box.container_id, snapshotImage], { timeout: 60000 });
    if (!result.ok) throw new HttpError(500, result.error);
    return snapshotImage;
  }

  return {
    runDocker,
    tryDocker,
    dockerErrorMessage,
    getDockerHealth,
    resolveDockerImage,
    isLightweightDemoImage,
    dockerCommandForImage,
    makeContainerName,
    normalizeMountPath,
    assertMountPath,
    createDockerContainer,
    inspectContainerStatus,
    pauseContainer,
    unpauseContainer,
    removeContainer,
    commitContainer,
  };
}

module.exports = {
  createDockerAdapter,
};
