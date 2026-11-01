# OWASP Juice Shop 接口测试文档

**版本：** 20.3.0  
**Base URL：** `http://localhost:3000`  
**协议：** HTTPS / JSON  
**测试工具：** Playwright APIRequestContext

---

## 1. 认证方式

登录接口成功后返回 JWT：

```http
POST /rest/user/login
Content-Type: application/json

{
  "email": "codex-order-...@example.com",
  "password": "Test123!"
}
```

后续需要认证的请求使用：

```http
Authorization: Bearer <jwt>
```

测试不会把 JWT 写入长期日志或最终报告。

---

## 2. 接口清单

| 编号 | 方法 | 路径 | 用途 | 期望状态 |
|---|---|---|---|---|
| API-001 | GET | `/api/Products` | 查询商品目录 | 200 |
| API-002 | GET | `/rest/products/search?q=apple` | 商品关键词搜索 | 200 |
| API-003 | POST | `/api/Users/` | 注册测试用户 | 201 |
| API-004 | POST | `/rest/user/login` | 正确凭证登录 | 200 |
| API-005 | POST | `/rest/user/login` | 错误密码登录 | 401 |
| API-006 | GET | `/rest/basket/{bid}` | 查询用户购物车 | 200 |
| API-007 | POST | `/api/BasketItems/` | 加入购物车 | 200 |
| API-008 | PUT | `/api/BasketItems/{id}` | 修改商品数量 | 200 |
| API-009 | POST | `/rest/basket/{bid}/checkout` | 提交订单 | 200 |
| API-010 | GET | `/rest/order-history` | 查询订单历史 | 200 |
| API-011 | POST | `/rest/basket/{bid}/checkout` | 钱包余额不足结算 | 4xx（实际 500） |

---

## 3. 请求与断言

### API-001 商品目录

请求：

```http
GET /api/Products
```

关键断言：

- HTTP 200。
- `status = success`。
- `data` 为非空数组。
- 商品包含 `id`、`name`、`price`。

### API-002 商品搜索

请求：

```http
GET /rest/products/search?q=apple
```

关键断言：

- HTTP 200。
- 至少返回 3 条匹配商品。
- 每条商品名称均包含 `apple`，不区分大小写。

### API-003 注册用户

请求：

```http
POST /api/Users/
Content-Type: application/json

{
  "email": "codex-order-...@example.com",
  "password": "Test123!",
  "passwordRepeat": "Test123!",
  "securityQuestion": {
    "id": 7,
    "question": "Name of your favorite pet?"
  },
  "securityAnswer": "Fluffy"
}
```

关键断言：

- HTTP 201。
- 返回新用户 `id`。
- 返回邮箱与请求邮箱一致。
- 不保存响应中的敏感密码字段。

### API-004 登录成功

请求：

```http
POST /rest/user/login
Content-Type: application/json

{
  "email": "codex-order-...@example.com",
  "password": "Test123!"
}
```

关键断言：

- HTTP 200。
- 返回 JWT。
- 返回用户购物车 ID `bid`。
- `umail` 与登录邮箱一致。

### API-005 错误密码

请求使用已注册账号和错误密码。

关键断言：

- HTTP 401。
- 响应包含 `Invalid email or password`。
- 不返回 JWT。

### API-006 查询购物车

请求：

```http
GET /rest/basket/{bid}
Authorization: Bearer <jwt>
```

关键断言：

- HTTP 200。
- `data.id = bid`。
- `Products` 为数组。

### API-007 加入购物车

请求：

```http
POST /api/BasketItems/
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "ProductId": 1,
  "BasketId": "{bid}",
  "quantity": 1
}
```

关键断言：

- HTTP 200。
- 返回购物车项 `id`。
- `ProductId = 1`。
- `BasketId` 与当前用户购物车一致。
- `quantity = 1`。

### API-008 修改商品数量

请求：

```http
PUT /api/BasketItems/{itemId}
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "quantity": 2
}
```

关键断言：

- HTTP 200。
- 响应 `quantity = 2`。

### API-009 结算订单

请求：

```http
POST /rest/basket/{bid}/checkout
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "orderDetails": {
    "paymentId": "card",
    "addressId": 1,
    "deliveryMethodId": 1
  }
}
```

关键断言：

- HTTP 200。
- 返回 `orderConfirmation`。
- 订单号符合 `xxxx-xxxxxxxxxxxxxxxx` 的格式。

### API-010 订单历史

请求：

```http
GET /rest/order-history
Authorization: Bearer <jwt>
```

关键断言：

- HTTP 200。
- `status = success`。
- 订单列表包含 API-009 生成的订单号。

注意：本轮接口探测确认正确路径是 `/rest/order-history`，不是 `/rest/orders`。错误路径返回 500 属于非预期路径，不计产品缺陷。

---

### API-011 钱包余额不足结算

请求：

```http
POST /rest/basket/{bid}/checkout
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "UserId": 25,
  "orderDetails": {
    "paymentId": "wallet",
    "addressId": 1,
    "deliveryMethodId": 1
  }
}
```

实际结果：

- 结算被拒绝。
- 响应提示 `Insufficient wallet balance.`。
- 购物车商品保留。
- 订单历史没有新增订单。
- HTTP 状态为 500。

建议：余额不足属于可预期业务错误，建议返回 402、409 或 422，而不是 500。

---

## 4. 完整业务链路

自动化实际执行顺序：

1. 注册唯一测试用户。
2. 登录获取 JWT、用户 ID 和购物车 ID。
3. 查询商品目录和 Apple 商品搜索结果。
4. 查询初始购物车。
5. 将 Apple Juice 加入购物车，数量为 1。
6. 将数量修改为 2。
7. 再次查询购物车，确认商品和数量。
8. 提交结算，获取订单确认号。
9. 查询订单历史，确认订单存在。

最终结果：全部步骤通过。

---

## 5. 订单取消能力

源码检查结果：

- `routes/order.ts` 只包含下单逻辑。
- `routes/orderHistory.ts` 只包含订单查询和配送状态操作。
- 不存在用户取消订单的 API 路由。
- 订单历史页面没有取消按钮。

结论：订单取消能力在当前版本中不存在，测试状态为 Not Applicable。

---

## 6. 未覆盖与限制

- 未验证未认证用户访问购物车的错误码和数据隔离。
- 未执行钱包余额成功充值、扣减和退款。
- 未执行删除购物车项和订单取消；订单取消能力本身不存在。
- 未执行高并发、限流和性能断言。
- 本轮性能与并发只执行小规模基线，不等同于容量测试。
- 本轮不进行安全漏洞验证。

