# OWASP-Juice-Shop-

只涵盖了一部分功能

**被测项目：** OWASP Juice Shop 20.3.0  
**测试地址：** 本地 `http://localhost:3000`  
**执行日期：** 2026-10-31

## 目录

| 目录 | 内容 |
|---|---|
| `01-docs/` | 测试计划、接口测试文档、测试报告 |
| `02-test-cases/` | 业务流程、接口和高级场景测试用例 Excel |
| `03-automation/` | Playwright 自动化测试工程 |
| `04-evidence/` | 日志、截图和失败证据 |
| `05-reports/` | JSON 与 HTML 自动化报告 |

## 主要交付物

- [测试计划](01-docs/01-test-plan.md)
- [接口测试文档](01-docs/02-api-test-document.md)
- [测试报告](01-docs/03-test-report.md)
- [高级场景报告](01-docs/04-advanced-scenarios-report.md)
- [Playwright CLI 使用指南](01-docs/05-playwright-cli-guide.md)
- [最终测试用例 Excel](02-test-cases/JuiceShop_QA_Test_Cases_Final.xlsx)
- [Playwright HTML 报告](05-reports/html/index.html)
- [Playwright JSON 结果](05-reports/results.json)

## 运行自动化

```powershell
cd 03-automation
$env:BASE_URL = "http://localhost:3000"
npm install
npm test
```

运行前需要先在 `http://localhost:3000` 启动 OWASP Juice Shop 20.3.0。

最终执行结果：**8 Passed / 0 Failed / 18.9s**。
