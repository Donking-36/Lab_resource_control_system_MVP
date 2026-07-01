const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { json, readJson } = require("../src/server/http");

function createResponse() {
  return {
    status: null,
    headers: null,
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

function createRequest(chunks) {
  const req = new EventEmitter();
  req.destroyedByReadJson = false;
  req.destroy = () => {
    req.destroyedByReadJson = true;
  };
  process.nextTick(() => {
    chunks.forEach((chunk) => req.emit("data", chunk));
    req.emit("end");
  });
  return req;
}

(async () => {
  {
    const res = createResponse();
    json(res, 201, { ok: true });

    assert.equal(res.status, 201);
    assert.deepEqual(res.headers, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    assert.equal(res.body, '{"ok":true}');
  }

  assert.deepEqual(await readJson(createRequest([])), {});
  assert.deepEqual(await readJson(createRequest(['{"student":"林可"}'])), { student: "林可" });
  await assert.rejects(
    () => readJson(createRequest(["{bad json"])),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /JSON 格式错误/);
      return true;
    },
  );

  {
    const tooLarge = createRequest(["x".repeat(1024 * 1024 + 1)]);
    await assert.rejects(
      () => readJson(tooLarge),
      (error) => {
        assert.equal(error.status, 413);
        assert.match(error.message, /请求体过大/);
        return true;
      },
    );
    assert.equal(tooLarge.destroyedByReadJson, true);
  }

  console.log("HTTP utility tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
