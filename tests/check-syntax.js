const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set([".git", "data", "node_modules"]);

function collectJavaScriptFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        files.push(...collectJavaScriptFiles(path.join(dir, entry.name)));
      }
      return;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(path.join(dir, entry.name));
    }
  });

  return files;
}

const files = collectJavaScriptFiles(ROOT).sort();

files.forEach((file) => {
  const relative = path.relative(ROOT, file);
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0) {
    console.error(`Syntax check failed: ${relative}`);
    process.exit(result.status || 1);
  }
});

console.log(`Syntax check passed for ${files.length} JavaScript files`);
