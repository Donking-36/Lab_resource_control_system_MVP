function selectGpuNode(nodes, requiredGpus) {
  return [...nodes]
    .filter((item) => item.totalGpu - item.usedGpu >= requiredGpus && item.ports.length)
    .sort((a, b) => a.usedGpu / a.totalGpu - b.usedGpu / b.totalGpu)[0];
}

function applyAllocationToNode(node, request, remainingPorts, nowText) {
  return {
    usedGpu: Math.min(node.totalGpu, node.usedGpu + request.gpus),
    memoryUsed: Math.min(node.memoryTotal, node.memoryUsed + request.gpus * 18),
    portsJson: JSON.stringify(remainingPorts),
    updatedAt: nowText,
  };
}

function returnPortToNode(node, box, nowText) {
  const ports = JSON.parse(node.ports_json || "[]");
  if (!ports.includes(box.port)) ports.push(box.port);
  ports.sort((a, b) => a - b);

  return {
    usedGpu: Math.max(0, node.used_gpu - box.gpus),
    memoryUsed: Math.max(0, node.memory_used - box.gpus * 18),
    portsJson: JSON.stringify(ports),
    updatedAt: nowText,
  };
}

module.exports = {
  selectGpuNode,
  applyAllocationToNode,
  returnPortToNode,
};
