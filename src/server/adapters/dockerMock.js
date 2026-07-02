const path = require("node:path");

// In-memory stand-in for the Docker CLI adapter. Exposes the identical surface
// the services/repositories consume so it can be swapped in via LAB_DOCKER_MODE=mock
// for tests and for defending the project on a host without Docker. It never
// pretends to talk to a real daemon: getDockerHealth reports mode "mock".
function createDockerMockAdapter({ containerPort, imageTemplates = {} } = {}) {
  const containersById = new Map();
  const idByName = new Map();
  let counter = 0;

  function resolveDockerImage(image) {
    return imageTemplates[image] || image;
  }

  function isLightweightDemoImage(image) {
    return image === "busybox-demo" || image === "busybox" || image === "busybox:latest";
  }

  function makeContainerName(requestId) {
    return `lab-rot-${requestId}`;
  }

  function getDockerHealth() {
    return { available: true, mode: "mock", cli: "docker-mock", server: "mock" };
  }

  function createDockerContainer({ request, port, name }) {
    const image = resolveDockerImage(request.image);
    const mountPath = path.resolve(request.dataset || ".");
    if (idByName.has(name)) {
      const previousId = idByName.get(name);
      containersById.delete(previousId);
      idByName.delete(name);
    }
    counter += 1;
    const containerId = `mock${String(counter).padStart(4, "0")}${Date.now().toString(16)}`;
    containersById.set(containerId, { id: containerId, name, image, status: "running", port });
    idByName.set(name, containerId);
    return { containerId, containerName: name, image, mountPath, containerPort };
  }

  function inspectContainerStatus(containerId) {
    if (!containerId) return "未创建";
    const container = containersById.get(containerId);
    return container ? container.status : "未知";
  }

  function pauseContainer(box) {
    const container = containersById.get(box.container_id);
    if (container) container.status = "paused";
  }

  function unpauseContainer(box) {
    const container = containersById.get(box.container_id);
    if (container) container.status = "running";
  }

  function removeContainer(box) {
    const container = containersById.get(box.container_id);
    if (container) {
      containersById.delete(box.container_id);
      idByName.delete(container.name);
    }
  }

  function commitContainer(box, nextVersion) {
    if (!box.container_id) return "";
    return `lab-snapshot:${box.id}-${nextVersion}`;
  }

  return {
    mode: "mock",
    resolveDockerImage,
    isLightweightDemoImage,
    makeContainerName,
    getDockerHealth,
    createDockerContainer,
    inspectContainerStatus,
    pauseContainer,
    unpauseContainer,
    removeContainer,
    commitContainer,
  };
}

module.exports = {
  createDockerMockAdapter,
};
