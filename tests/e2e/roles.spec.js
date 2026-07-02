const { test, expect } = require("@playwright/test");

const accounts = {
  admin: ["admin", "admin-test-pass"],
  mentor: ["mentor", "mentor-test-pass"],
  student: ["lin", "lin-test-pass"],
};

async function login(page, role) {
  const [username, password] = accounts[role];
  await page.goto("/");
  await expect(page.locator("#loginView")).toBeVisible();
  await page.locator('#loginForm [name="username"]').fill(username);
  await page.locator('#loginForm [name="password"]').fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await expect(page.locator("#appShell")).toBeVisible();
}

test("未登录接口受保护且错误包含请求 ID", async ({ request }) => {
  const response = await request.get("/api/state");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.code).toBe("UNAUTHENTICATED");
  expect(body.requestId).toBeTruthy();
});

test("错误密码可读，管理员可查看调度、审计和算法证据", async ({ page }) => {
  await page.goto("/");
  await page.locator('#loginForm [name="username"]').fill("admin");
  await page.locator('#loginForm [name="password"]').fill("wrong-password");
  await page.locator("#loginForm button[type=submit]").click();
  await expect(page.locator("#loginError")).toContainText("用户名或密码错误");

  await page.locator('#loginForm [name="password"]').fill("admin-test-pass");
  await page.locator("#loginForm button[type=submit]").click();
  await expect(page.locator("#currentUserRole")).toHaveText("管理员");
  await expect(page.locator("#autoScheduleBtn")).toBeVisible();
  await expect(page.locator('[data-capability="audit:view"]')).toBeVisible();
  await expect(page.locator("#algorithmReportMeta")).toContainText("xfs-v1");
  await expect(page.locator("#algorithmReportTable")).toContainText("XFS-V1");
});

test("学生只能提交本人申请并管理本人沙箱", async ({ page }) => {
  await login(page, "student");
  await expect(page.locator("#currentUserName")).toHaveText("林可");
  await expect(page.locator("#autoScheduleBtn")).toBeHidden();
  await expect(page.locator('[data-capability="evaluation:save"]')).toBeHidden();
  await expect(page.locator('[data-capability="audit:view"]')).toBeHidden();

  const student = page.locator('#requestForm [name="student"]');
  await expect(student).toHaveValue("林可");
  await expect(student).toHaveAttribute("readonly", "");
  await page.locator('#requestForm [name="topic"]').fill("E2E 可解释分割实验");
  await page.locator('#requestForm [name="dataset"]').fill("/datasets/e2e");
  await page.locator("#requestForm button[type=submit]").click();
  await expect(page.locator("#toast")).toContainText("算力申请已保存");
  await expect(page.locator("#requestQueue")).toContainText("E2E 可解释分割实验");
  await expect(page.locator("#requestQueue [data-action=approve]")).toHaveCount(0);
});

test("导师可推进轮转和评分但不能操作容器", async ({ page }) => {
  await login(page, "mentor");
  await expect(page.locator("#currentUserRole")).toHaveText("导师");
  await expect(page.locator("#autoScheduleBtn")).toBeHidden();
  await expect(page.locator("#requestForm")).toBeHidden();
  await expect(page.locator("#rotationList [data-action=progress]").first()).toBeVisible();
  await expect(page.locator("#sandboxTable [data-action=release]")).toHaveCount(0);

  await page.locator("#rotationList [data-action=progress]").first().click();
  await expect(page.locator("#toast")).toContainText("轮转节点进度已写入数据库");
  await page.locator("#evaluationForm button[type=submit]").click();
  await expect(page.locator("#toast")).toContainText("导师评分已保存");
});

test("知识图谱节点和筛选标题保持清晰分离", async ({ page }) => {
  await login(page, "admin");
  await page.locator("#knowledge").scrollIntoViewIfNeeded();
  await expect(page.locator("#knowledgeGraph .graph-node")).toHaveCount(13);

  const layout = await page.locator("#knowledge").evaluate((section) => {
    const boxes = Array.from(section.querySelectorAll(".graph-node")).map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    });
    const overlappingNodes = [];
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        const overlaps =
          boxes[first].left < boxes[second].right &&
          boxes[first].right > boxes[second].left &&
          boxes[first].top < boxes[second].bottom &&
          boxes[first].bottom > boxes[second].top;
        if (overlaps) overlappingNodes.push([first, second]);
      }
    }

    const heading = section.querySelector("h2").getBoundingClientRect();
    const filter = section.querySelector("#knowledgeFilter").getBoundingClientRect();
    const headerOverlap =
      heading.left < filter.right &&
      heading.right > filter.left &&
      heading.top < filter.bottom &&
      heading.bottom > filter.top;
    return { overlappingNodes, headerOverlap };
  });

  expect(layout.overlappingNodes).toEqual([]);
  expect(layout.headerOverlap).toBe(false);

  await page.locator("#knowledgeFilter").selectOption("目标检测");
  await expect(page.locator("#knowledgeGraph .graph-node")).toHaveCount(5);
});

test("破坏性操作要求确认，手机视口保持可用", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "admin");
  const reject = page.locator("#requestQueue [data-action=reject]").first();
  await reject.click();
  await expect(page.locator("#confirmDialog")).toBeVisible();
  await page.locator('#confirmDialog button[value="cancel"]').click();
  await expect(page.locator("#confirmDialog")).toBeHidden();
  await expect(page.locator("#appShell")).toBeVisible();
  await expect(page.locator("#globalSearch")).toBeVisible();
});
