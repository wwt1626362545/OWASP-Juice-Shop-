# 性能、并发、取消订单与钱包余额测试报告

**环境：** 本地官方打包版 OWASP Juice Shop 20.3.0  
**地址：** `http://localhost:3000`  
**执行日期：** 2026-10-31

---

## 1. 结果总览

| 场景 | 判定 | 关键结果 |
|---|---|---|
| 性能基线 | Passed | P95 22.24 ms，20/20 成功 |
| 并发搜索 | Passed | 5/5 成功，总耗时 67.87 ms |
| 并发加购 | Issue | 1 个 200，4 个 500；最终数据一致 |
| 取消订单 | Not Applicable | 无取消接口和 UI 操作 |
| 钱包余额不足 | Issue | 正确拒绝订单，但返回 500 |

---

## 2. 顺序性能基线

测试接口：

```http
GET /rest/products/search?q=apple
```

方法：

- 预热 3 次。
- 顺序执行 20 次。
- 记录每次耗时和成功状态。

| 指标 | 结果 |
|---|---:|
| 最小 | 14.28 ms |
| 平均 | 19.28 ms |
| P50 | 17.91 ms |
| P90 | 21.33 ms |
| P95 | 22.24 ms |
| 最大 | 37.44 ms |
| 成功数 | 20/20 |

原始数据：`04-evidence/logs/performance-results.json`。

---

## 3. 并发探测

### 3.1 并发搜索

- 5 个同时请求。
- 5/5 返回 200。
- 总耗时 67.87 ms。
- 每条响应均返回至少 3 条商品。

### 3.2 同一购物车并发加购

- 5 个同时请求，同一用户、购物车和商品。
- 1 个返回 200。
- 4 个返回 500。
- 最终购物车只有 1 条商品，数量为 1。

数据一致性通过，但并发冲突应返回 409 或明确的可重试错误，而不是 500。

原始数据：`04-evidence/logs/concurrency-results.json`。

---

## 4. 取消订单能力

检查结果：

- API 路由中没有取消订单端点。
- 订单历史页面不存在取消按钮。
- 因此无法执行真正意义上的订单取消。

这不是测试阻塞，而是当前版本产品能力缺失。状态记录为 **Not Applicable**。

证据：

- `04-evidence/logs/cancel-order-capability.json`
- `04-evidence/screenshots/order-history-no-cancel.png`

---

## 5. 钱包余额测试

场景：

- 新用户钱包余额为 0。
- 购物车加入 Apple Juice。
- 使用 `paymentId=wallet` 结算。

结果：

- 结算被拒绝。
- 购物车商品保留。
- 订单历史没有新增订单。
- HTTP 响应为 500，错误提示为 `Insuffic ient wallet balance.`。

业务拦截正确，错误映射不合格。建议返回 402、409 或 422。

原始数据：`04-evidence/logs/wallet-insufficient-payment.json`。

