const { expect } = require("@playwright/test");

const TEST_PASSWORD = "Test123!";

function uniqueEmail(prefix = "codex-qa") {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}-${suffix}@example.com`;
}

async function registerUser(request, email) {
  const response = await request.post("/api/Users/", {
    data: {
      email,
      password: TEST_PASSWORD,
      passwordRepeat: TEST_PASSWORD,
      securityQuestion: {
        id: 7,
        question: "Name of your favorite pet?"
      },
      securityAnswer: "Fluffy"
    }
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.email).toBe(email);
  return body.data;
}

async function login(request, email, password = TEST_PASSWORD) {
  const response = await request.post("/rest/user/login", {
    data: { email, password }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.authentication.token).toBeTruthy();
  expect(body.authentication.bid).toBeGreaterThan(0);
  return body.authentication;
}

async function dismissOverlays(page) {
  const overlays = [
    page.getByRole("button", { name: /close welcome banner/i }),
    page.getByRole("button", { name: /dismiss cookie message/i })
  ];

  for (const overlay of overlays) {
    const appeared = await overlay
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await overlay.click({ force: true });
      await overlay.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }
  }
}

module.exports = {
  TEST_PASSWORD,
  uniqueEmail,
  registerUser,
  login,
  dismissOverlays
};
