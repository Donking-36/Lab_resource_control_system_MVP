const assert = require("node:assert/strict");

const { createEventHandlers } = require("../src/client/events");
const { priorityScore } = require("../src/client/rules");

function createHandlers(overrides = {}) {
  const calls = [];
  const state = overrides.state || {
    requests: [],
    gpuMonitor: { source: "seed" },
  };
  const handlers = createEventHandlers({
    state,
    els: {},
    documentRef: {
      querySelector() {
        return {
          addEventListener() {},
        };
      },
    },
    api: {
      async loadState({ updateState, renderAll }) {
        calls.push({ name: "loadState" });
        updateState({ loaded: true });
        renderAll();
      },
      async mutate(path, options, { updateState, renderAll }) {
        calls.push({ name: "mutate", path, options });
        updateState({ mutated: path });
        renderAll();
        return { ok: true };
      },
    },
    updateState(data) {
      calls.push({ name: "updateState", data });
      Object.assign(state, data);
    },
    renderer: {
      renderAll() {
        calls.push({ name: "renderAll" });
      },
      renderRoleHint() {},
      renderKnowledge() {},
      applySearch() {},
      estimateHours() {},
    },
    showToast(message) {
      calls.push({ name: "showToast", message });
    },
    rules: { priorityScore },
  });
  return { calls, handlers, state };
}

function createSubmitEvent(values) {
  return {
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    currentTarget: {
      resetCalled: false,
      reset() {
        this.resetCalled = true;
      },
      values,
    },
  };
}

class FakeFormData {
  constructor(target) {
    this.values = target.values;
  }

  get(name) {
    return this.values[name];
  }
}

(async () => {
  const originalFormData = globalThis.FormData;
  globalThis.FormData = FakeFormData;

  try {
    {
      const { calls, handlers } = createHandlers({
        state: {
          requests: [
            { id: 1, status: "waiting", urgency: 1, credit: 80, gpus: 1, hours: 80 },
            { id: 2, status: "waiting", urgency: 5, credit: 95, gpus: 1, hours: 8 },
            { id: 3, status: "rejected", urgency: 5, credit: 100, gpus: 1, hours: 1 },
          ],
          gpuMonitor: { source: "seed" },
        },
      });

      handlers.autoSchedule();
      await Promise.resolve();

      assert.equal(calls[0].name, "mutate");
      assert.equal(calls[0].path, "/api/requests/2/approve");
      assert.deepEqual(calls[0].options, { method: "POST" });
      assert.equal(calls.at(-1).message, "申请已批准并写入数据库。");
    }

    {
      const { calls, handlers } = createHandlers();
      handlers.autoSchedule();
      assert.deepEqual(calls, [{ name: "showToast", message: "队列为空。" }]);
    }

    {
      const { calls, handlers } = createHandlers();
      await handlers.releaseSandbox("lab rot/7");
      assert.equal(calls[0].path, "/api/sandboxes/lab%20rot%2F7");
      assert.deepEqual(calls[0].options, { method: "DELETE" });
      assert.equal(calls.at(-1).message, "沙箱资源已释放并更新数据库。");
    }

    {
      const { calls, handlers } = createHandlers();
      const event = createSubmitEvent({
        student: "  ",
        topic: "医学图像分割",
        dataset: "/datasets/medical",
      });

      await handlers.submitRequest(event);
      assert.equal(event.prevented, true);
      assert.deepEqual(calls, [{ name: "showToast", message: "请补全学生、研究方向和数据集挂载路径。" }]);
    }

    {
      const { calls, handlers } = createHandlers();
      const event = createSubmitEvent({
        student: " 林可 ",
        topic: " 小模型微调 ",
        dataset: " /datasets/tiny ",
        gpus: "2",
        hours: "12",
        urgency: "4",
        image: "busybox-demo",
      });

      await handlers.submitRequest(event);

      assert.equal(event.prevented, true);
      assert.equal(event.currentTarget.resetCalled, true);
      assert.equal(calls[0].path, "/api/requests");
      assert.equal(calls[0].options.method, "POST");
      assert.deepEqual(JSON.parse(calls[0].options.body), {
        student: "林可",
        topic: "小模型微调",
        gpus: 2,
        hours: 12,
        urgency: 4,
        image: "busybox-demo",
        dataset: "/datasets/tiny",
      });
      assert.equal(calls.at(-1).message, "算力申请已保存到数据库。");
    }

    console.log("Client event tests passed");
  } finally {
    if (originalFormData) {
      globalThis.FormData = originalFormData;
    } else {
      delete globalThis.FormData;
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
