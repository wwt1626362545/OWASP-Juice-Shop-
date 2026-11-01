const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  uniqueEmail,
  registerUser,
  login
} = require("./helpers");

test.describe("Juice Shop API", () => {
  test("商品目录和搜索接口返回可断言的业务数据", async ({ request }) => {
    const productsResponse = await request.get("/api/Products");
    expect(productsResponse.status()).toBe(200);

    const productsBody = await productsResponse.json();
    expect(productsBody.status).toBe("success");
    expect(Array.isArray(productsBody.data)).toBe(true);
    expect(productsBody.data.length).toBeGreaterThan(0);
    expect(productsBody.data[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      price: expect.any(Number)
    });

    const searchResponse = await request.get("/rest/products/search?q=apple");
    expect(searchResponse.status()).toBe(200);

    const searchBody = await searchResponse.json();
    expect(searchBody.status).toBe("success");
    expect(searchBody.data.length).toBeGreaterThanOrEqual(3);
    expect(
      searchBody.data.every((product) =>
        product.name.toLowerCase().includes("apple")
      )
    ).toBe(true);
  });

  test("登录成功返回令牌，错误密码被拒绝", async ({ request }) => {
    const email = uniqueEmail("codex-auth");
    await registerUser(request, email);

    const authentication = await login(request, email);
    expect(authentication.umail).toBe(email);
    expect(authentication.bid).toBeGreaterThan(0);

    const invalidResponse = await request.post("/rest/user/login", {
      data: {
        email,
        password: "wrong-password"
      }
    });
    expect(invalidResponse.status()).toBe(401);
    expect((await invalidResponse.text()).toLowerCase()).toContain(
      "invalid email or password"
    );
  });

  test("注册到下单的完整业务链路成功", async ({ request }, testInfo) => {
    const email = uniqueEmail("codex-order");
    const createdUser = await registerUser(request, email);
    const authentication = await login(request, email);
    const headers = {
      authorization: `Bearer ${authentication.token}`
    };
    const steps = [];

    const basketBefore = await request.get(
      `/rest/basket/${authentication.bid}`,
      { headers }
    );
    expect(basketBefore.status()).toBe(200);
    const basketBeforeBody = await basketBefore.json();
    expect(basketBeforeBody.data.id).toBe(authentication.bid);
    steps.push("查询初始购物车");

    const searchResponse = await request.get("/rest/products/search?q=apple");
    expect(searchResponse.status()).toBe(200);
    const searchBody = await searchResponse.json();
    const apple = searchBody.data.find(
      (product) => product.name === "Apple Juice (1000ml)"
    );
    expect(apple).toBeTruthy();
    steps.push("搜索 Apple Juice");

    const addResponse = await request.post("/api/BasketItems/", {
      headers,
      data: {
        ProductId: apple.id,
        BasketId: authentication.bid,
        quantity: 1
      }
    });
    expect(addResponse.status()).toBe(200);
    const addBody = await addResponse.json();
    expect(addBody.data).toMatchObject({
      ProductId: apple.id,
      BasketId: authentication.bid,
      quantity: 1
    });
    const basketItemId = addBody.data.id;
    steps.push("加入购物车");

    const updateResponse = await request.put(
      `/api/BasketItems/${basketItemId}`,
      {
        headers,
        data: { quantity: 2 }
      }
    );
    expect(updateResponse.status()).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody.data.quantity).toBe(2);
    steps.push("修改商品数量为 2");

    const basketAfter = await request.get(
      `/rest/basket/${authentication.bid}`,
      { headers }
    );
    expect(basketAfter.status()).toBe(200);
    const basketAfterBody = await basketAfter.json();
    const basketProduct = basketAfterBody.data.Products.find(
      (product) => product.id === apple.id
    );
    expect(basketProduct).toBeTruthy();
    expect(basketProduct.BasketItem.quantity).toBe(2);
    steps.push("校验购物车商品数量");

    const checkoutResponse = await request.post(
      `/rest/basket/${authentication.bid}/checkout`,
      {
        headers,
        data: {
          orderDetails: {
            paymentId: "card",
            addressId: 1,
            deliveryMethodId: 1
          }
        }
      }
    );
    expect(checkoutResponse.status()).toBe(200);
    const checkoutBody = await checkoutResponse.json();
    expect(checkoutBody.orderConfirmation).toMatch(/^[a-f0-9]{4}-[a-f0-9]{16}$/i);
    const orderId = checkoutBody.orderConfirmation;
    steps.push("提交订单");

    const historyResponse = await request.get("/rest/order-history", {
      headers
    });
    expect(historyResponse.status()).toBe(200);
    const historyBody = await historyResponse.json();
    expect(historyBody.status).toBe("success");
    expect(historyBody.data.some((order) => order.orderId === orderId)).toBe(
      true
    );
    steps.push("在订单历史中找到新订单");

    const evidence = {
      target: "OWASP Juice Shop 20.3.0",
      email,
      userId: createdUser.id,
      basketId: authentication.bid,
      product: {
        id: apple.id,
        name: apple.name,
        price: apple.price
      },
      orderId,
      steps
    };

    await testInfo.attach("business-flow-result", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json"
    });

    const evidenceDir = path.resolve(__dirname, "..", "..", "04-evidence", "logs");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(
      path.join(evidenceDir, "automated-business-flow-pass.json"),
      JSON.stringify(evidence, null, 2)
    );
  });
});
