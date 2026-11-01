const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  TEST_PASSWORD,
  uniqueEmail,
  registerUser,
  dismissOverlays
} = require("./helpers");

test("UI 完成登录、商品搜索、加入购物车和购物车校验", async ({
  page,
  request
}) => {
  const email = uniqueEmail("codex-ui");
  await registerUser(request, email);

  await page.goto("/#/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor();
  await dismissOverlays(page);

  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/rest/user/login")
  );
  await page.locator("#loginButton").click();
  expect((await loginResponsePromise).status()).toBe(200);
  await expect(page).not.toHaveURL(/#\/login/);

  await page.goto("/#/search?q=apple", { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await expect(page.getByText("Search Results - apple", { exact: true })).toBeVisible();

  await expect(page.getByRole("button", { name: "Add to Basket" })).toHaveCount(3);
  const addToBasketResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/BasketItems/")
  );
  await page.getByRole("button", { name: "Add to Basket" }).first().click();
  expect((await addToBasketResponsePromise).status()).toBe(200);

  const basketResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/rest\/basket\/\d+$/.test(response.url())
  );
  await page.getByRole("button", { name: /show the shopping cart/i }).click();
  expect((await basketResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/#\/basket/);
  await expect(page.getByText("Your Basket").first()).toBeVisible();

  const productRow = page.getByRole("row").filter({
    hasText: "Apple Juice (1000ml)"
  });
  await expect(productRow).toBeVisible();
  await expect(productRow).toContainText("1.99");

  await page.screenshot({
    path: path.resolve(
      __dirname,
      "..",
      "..",
      "04-evidence",
      "screenshots",
      "ui-basket-success.png"
    ),
    fullPage: true
  });
});
