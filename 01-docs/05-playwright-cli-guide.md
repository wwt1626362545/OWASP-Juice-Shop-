# Playwright CLI 本地部署

**安装位置：** `D:\Codex\ttone\03-automation`  
**浏览器缓存：** `D:\Codex\playwright-cli\browsers`  
**CLI 会话缓存：** `D:\Codex\playwright-cli\daemon`  
**本地应用数据：** `D:\Codex\playwright-cli\localappdata`  
**持久化配置：** `D:\Codex\playwright-cli\profiles\juice-shop`  
**默认浏览器：** Microsoft Edge

---

## 1. 已安装的 Playwright Skills

技能目录：

```text
D:\Codex\ttone\03-automation\.agents\skills
```

| Skill | 用途 |
|---|---|
| `playwright-cli` | 浏览器打开、元素快照、交互、网络请求、Mock、Tracing 和测试生成 |
| `playwright-component-testing` | React/Vue 组件隔离测试、Story Gallery 和组件测试迁移 |
| `playwright-trace` | 从命令行检查 Trace 中的动作、请求、Console、错误和截图 |

这三个 Skill 均为项目级安装，实际文件全部位于 D 盘。

---

## 2. 启动本地应用

```powershell
cd D:\Codex\ttone\work\app\local\juice-shop_20.3.0
F:\node\node.exe build\app.js
```

应用地址：

```text
http://localhost:3000
```

---

## 3. 启动 Playwright CLI

进入自动化目录：

```powershell
cd D:\Codex\ttone\03-automation
```

打开本地应用：

```powershell
npm run pw:open
```

该命令使用独立会话 `juice`、Microsoft Edge 和 D 盘持久化浏览器目录。

需要查看并有头操作浏览器时：

```powershell
npm run pw:open:headed
```

---

## 4. 页面快照与截图

获取可访问性快照：

```powershell
npm run pw:snapshot
```

保存全页截图：

```powershell
npm run pw:screenshot
```

通过 `npm run pw --` 手工传入截图路径时，请使用正斜杠，避免 Windows 反斜杠被 npm 参数层吞掉：

```powershell
npm run pw -- -s=juice screenshot --full-page --filename=D:/Codex/ttone/04-evidence/screenshots/example.png
```

截图位置：

```text
D:\Codex\ttone\04-evidence\screenshots\playwright-cli-home.png
```

---

## 5. 常用交互

```powershell
npm run pw -- -s=juice find "Login"
npm run pw -- -s=juice click <element-ref>
npm run pw -- -s=juice fill <element-ref> "codex@example.com"
npm run pw -- -s=juice press Enter
npm run pw -- -s=juice requests
npm run pw -- -s=juice console
```

其中 `<element-ref>` 来自 `snapshot` 或 `find` 输出的元素引用。

---

## 6. 会话与 Tracing

查看会话：

```powershell
npm run pw:list
```

开始和停止 Trace：

```powershell
npm run pw -- -s=juice tracing-start
npm run pw -- -s=juice tracing-stop
```

关闭会话：

```powershell
npm run pw:close
```

---

## 7. 直接使用包装脚本

CMD 或 PowerShell 均可调用：

```powershell
cd D:\Codex\ttone\03-automation
.\bin\pw.cmd -s=juice snapshot
```

包装脚本会自动设置 `PLAYWRIGHT_BROWSERS_PATH`、`PWTEST_DAEMON_SESSION_DIR` 和子进程 `LOCALAPPDATA`，避免把浏览器缓存和 CLI 会话写入 C 盘。

