const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  TEST_PASSWORD,
  login,
  dismissOverlays
} = require("./helpers");

const SUITE_EMAIL = "codex-suite-20261031@example.com";
const evidenceDir = path.resolve(__dirname, "..", "..", "04-evidence", "logs");
const screenshotDir = path.resolve(
  __dirname,
  "..",
  "..",
  "04-evidence",
  "screenshots"
);

function writeEvidence(name, value) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, name),
    JSON.stringify(value, null, 2)
  );
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * fraction) - 1;
  return sorted[Math.max(0, index)];
}

function summarizeDurations(durations) {
  const total = durations.reduce((sum, value) => sum + value, 0);
  return {
    count: durations.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    avgMs: total / durations.length,
    p50Ms: percentile(durations, 0.5),
    p90Ms: percentile(durations, 0.9),
    p95Ms: percentile(durations, 0.95)
  };
}

let suiteAccount;

function decodeToken(token) {
  return JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8")
  );
}

async function getSuiteAccount(request) {
  if (suiteAccount) {
    return suiteAccount;
  }

  let userId;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request.post("/api/Users/", {
      data: {
        email: SUITE_EMAIL,
        password: TEST_PASSWORD,
        passwordRepeat: TEST_PASSWORD,
        securityQuestion: {
          id: 7,
          question: "Name of your favorite pet?"
        },
        securityAnswer: "Fluffy"
      }
    });

    if (response.status() === 201) {
      userId = (await response.json()).data.id;
      break;
    }
    if (response.status() === 400 || response.status() === 409) {
      break;
    }
    if (response.status() === 503 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      continue;
    }
    throw new Error(
      `Suite account setup failed with status ${response.status()}: ${(
        await response.text()
      ).slice(0, 300)}`
    );
  }

  const authentication = await login(request, SUITE_EMAIL);
  if (!userId) {
    userId = decodeToken(authentication.token).data.id;
  }

  suiteAccount = {
    email: SUITE_EMAIL,
    user: { id: userId, email: SUITE_EMAIL },
    authentication,
    headers: {
      authorization: `Bearer ${authentication.token}`
    }
  };
  return suiteAccount;
}

async function addAppleJuice(request, account, quantity = 1) {
  const response = await request.post("/api/BasketItems/", {
    headers: account.headers,
    data: {
      ProductId: 1,
      BasketId: account.authentication.bid,
      quantity
    }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

async function clearBasket(request, account) {
  const response = await request.get(
    `/rest/basket/${account.authentication.bid}`,
    { headers: account.headers }
  );
  expect(response.status()).toBe(200);
  const basket = await response.json();
  for (const product of basket.data.Products) {
    if (product.BasketItem?.id) {
      const deleteResponse = await request.delete(
        `/api/BasketItems/${product.BasketItem.id}`,
        { headers: account.headers }
      );
      expect(deleteResponse.status()).toBe(200);
    }
  }
}

async function checkout(request, account, paymentId) {
  return request.post(
    `/rest/basket/${account.authentication.bid}/checkout`,
    {
      headers: account.headers,
      data: {
        UserId: account.user.id,
        orderDetails: {
          paymentId,
          addressId: 1,
          deliveryMethodId: 1
        }
      }
    }
  );
}

test("性能基线：顺序搜索的商品接口延迟统计", async ({ request }, testInfo) => {
  for (let index = 0; index < 3; index++) {
    const warmup = await request.get("/rest/products/search?q=apple");
    expect(warmup.status()).toBe(200);
  }

  const runs = [];
  for (let index = 0; index < 20; index++) {
    const startedAt = performance.now();
    const response = await request.get("/rest/products/search?q=apple");
    const durationMs = performance.now() - startedAt;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    runs.push({ index: index + 1, durationMs });
  }

  const summary = summarizeDurations(runs.map((run) => run.durationMs));
  const baseURL = testInfo.project.use.baseURL || "unknown";
  const evidence = {
    endpoint: "GET /rest/products/search?q=apple",
    iterations: runs.length,
    baseURL,
    environment: baseURL.includes("localhost")
      ? "Local packaged Juice Shop 20.3.0"
      : "Public demo over the Internet",
    threshold: "Sanity threshold: p95 < 5000 ms",
    summary,
    runs
  };
  writeEvidence("performance-results.json", evidence);
  await testInfo.attach("performance-results", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json"
  });

  expect(summary.p95Ms).toBeLessThan(5_000);
});

test("并发：并行商品搜索和同一购物车并发加购", async ({ request }, testInfo) => {
  const account = await getSuiteAccount(request);
  await clearBasket(request, account);

  const searchStartedAt = performance.now();
  const searchResponses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.get("/rest/products/search?q=apple")
    )
  );
  const searchDurationMs = performance.now() - searchStartedAt;

  for (const response of searchResponses) {
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(3);
  }

  const addStartedAt = performance.now();
  const addResponses = await Promise.all(
    Array.from({ length: 5 }, () =>
      request.post("/api/BasketItems/", {
        headers: account.headers,
        data: {
          ProductId: 1,
          BasketId: account.authentication.bid,
          quantity: 1
        }
      })
    )
  );
  const addDurationMs = performance.now() - addStartedAt;
  const addStatuses = addResponses.map((response) => response.status());
  const successfulAdds = addStatuses.filter(
    (status) => status === 200 || status === 201
  ).length;
  expect(successfulAdds).toBeGreaterThan(0);

  const basketResponse = await request.get(
    `/rest/basket/${account.authentication.bid}`,
    { headers: account.headers }
  );
  expect(basketResponse.status()).toBe(200);
  const basket = await basketResponse.json();
  const appleRows = basket.data.Products.filter(
    (product) => product.id === 1 && product.BasketItem
  );
  const persistedQuantity = appleRows.reduce(
    (sum, product) => sum + product.BasketItem.quantity,
    0
  );

  const evidence = {
    search: {
      concurrency: 5,
      totalDurationMs: searchDurationMs,
      successCount: searchResponses.filter((response) => response.status() === 200)
        .length
    },
    concurrentAddToBasket: {
      concurrency: 5,
      totalDurationMs: addDurationMs,
      statuses: addStatuses,
      successfulAdds,
      persistedProductRows: appleRows.length,
      persistedQuantity
    }
  };
  writeEvidence("concurrency-results.json", evidence);
  await testInfo.attach("concurrency-results", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json"
  });

  expect(persistedQuantity).toBe(successfulAdds);
});

test("取消订单能力：订单历史不提供取消操作", async ({
  page,
  request
}, testInfo) => {
  const account = await getSuiteAccount(request);
  await clearBasket(request, account);
  await addAppleJuice(request, account);
  const checkoutResponse = await checkout(request, account, "card");
  expect(checkoutResponse.status()).toBe(200);
  const orderId = (await checkoutResponse.json()).orderConfirmation;

  await page.goto("/#/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor();
  await dismissOverlays(page);
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#loginButton").click();
  await expect(page).not.toHaveURL(/#\/login/);

  await page.goto("/#/order-history", { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await expect(page.getByText(orderId, { exact: false })).toBeVisible();

  const cancelButtons = page
    .locator("main")
    .getByRole("button", { name: /cancel.*order|取消订单/i });
  await expect(cancelButtons).toHaveCount(0);

  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, "order-history-no-cancel.png"),
    fullPage: true
  });

  const evidence = {
    orderId,
    sourceRoutesReviewed: [
      "routes/order.ts",
      "routes/orderHistory.ts"
    ],
    finding:
      "Order history exposes no user-facing cancellation action and the reviewed routes contain no cancel-order endpoint.",
    status: "Not Applicable / Product capability absent"
  };
  writeEvidence("cancel-order-capability.json", evidence);
  await testInfo.attach("cancel-order-capability", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json"
  });
});

test("支付余额：新用户钱包余额不足时拒绝订单", async ({
  request
}, testInfo) => {
  const account = await getSuiteAccount(request);
  await clearBasket(request, account);

  const historyBeforeResponse = await request.get("/rest/order-history", {
    headers: account.headers
  });
  expect(historyBeforeResponse.status()).toBe(200);
  const historyBefore = await historyBeforeResponse.json();
  const orderIdsBefore = new Set(historyBefore.data.map((order) => order.orderId));

  await addAppleJuice(request, account);

  const checkoutResponse = await checkout(request, account, "wallet");
  const responseText = await checkoutResponse.text();
  expect(checkoutResponse.status()).not.toBe(200);
  expect(responseText.toLowerCase()).toContain("insufficient wallet balance");

  const basketResponse = await request.get(
    `/rest/basket/${account.authentication.bid}`,
    { headers: account.headers }
  );
  expect(basketResponse.status()).toBe(200);
  const basket = await basketResponse.json();
  expect(
    basket.data.Products.some(
      (product) => product.id === 1 && product.BasketItem
    )
  ).toBe(true);

  const historyResponse = await request.get("/rest/order-history", {
    headers: account.headers
  });
  expect(historyResponse.status()).toBe(200);
  const history = await historyResponse.json();
  const orderIdsAfter = history.data.map((order) => order.orderId);
  expect(orderIdsAfter).toEqual(expect.arrayContaining([...orderIdsBefore]));
  expect(orderIdsAfter).toHaveLength(orderIdsBefore.size);

  const evidence = {
    userId: account.user.id,
    basketId: account.authentication.bid,
    paymentId: "wallet",
    responseStatus: checkoutResponse.status(),
    responseExcerpt: responseText.slice(0, 400),
    cartPreserved: true,
    orderCreated: false,
    orderIdsBefore: [...orderIdsBefore],
    orderIdsAfter,
    finding:
      "Insufficient wallet balance blocks checkout. The current API returns a 500-style error instead of a clear 4xx business error."
  };
  writeEvidence("wallet-insufficient-payment.json", evidence);
  await testInfo.attach("wallet-insufficient-payment", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json"
  });
});
