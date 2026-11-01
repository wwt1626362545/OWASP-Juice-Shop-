import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cliEntry = path.join(
  projectRoot,
  "node_modules",
  "playwright",
  "cli.js"
);

const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: "D:\\Codex\\playwright-cli\\browsers",
  PWTEST_DAEMON_SESSION_DIR: "D:\\Codex\\playwright-cli\\daemon",
  LOCALAPPDATA: "D:\\Codex\\playwright-cli\\localappdata"
};

const child = spawn(
  process.execPath,
  [cliEntry, "cli", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env,
    stdio: "inherit"
  }
);

child.on("error", (error) => {
  console.error(`Failed to start Playwright CLI: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Playwright CLI stopped by signal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
