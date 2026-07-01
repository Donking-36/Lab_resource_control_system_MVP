const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_IMAGE_TEMPLATES = {
  "busybox-demo": "busybox:latest",
  "pytorch-2.3-cuda12": "pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime",
  "pytorch-1.13-cuda11": "pytorch/pytorch:1.13.1-cuda11.6-cudnn8-runtime",
  "tensorflow-2.16": "tensorflow/tensorflow:2.16.1-gpu",
};

function createConfig(env = process.env, root = DEFAULT_ROOT) {
  const dataDir = path.join(root, "data");
  return {
    ROOT: root,
    DATA_DIR: dataDir,
    DB_PATH: env.LAB_MVP_DB || path.join(dataDir, "lab_resource.db"),
    PORT: Number(env.PORT || 3000),
    CONTAINER_PORT: Number(env.LAB_CONTAINER_PORT || 8888),
    IMAGE_TEMPLATES: { ...DEFAULT_IMAGE_TEMPLATES },
  };
}

const config = createConfig();

module.exports = {
  createConfig,
  ROOT: config.ROOT,
  DATA_DIR: config.DATA_DIR,
  DB_PATH: config.DB_PATH,
  PORT: config.PORT,
  CONTAINER_PORT: config.CONTAINER_PORT,
  IMAGE_TEMPLATES: config.IMAGE_TEMPLATES,
};
