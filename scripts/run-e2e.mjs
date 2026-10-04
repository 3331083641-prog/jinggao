import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A fresh checkout has no copied PDF fonts/CMaps. Prepare them from installed
// dependencies even when Playwright launches Vite directly in CI mode.
await import("./prepare-pdf-assets.mjs");
const child = spawn(
  process.execPath,
  [
    path.join(root, "frontend/node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(2),
  ],
  {
    cwd: path.join(root, "frontend"),
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ||
        path.join(root, ".cache/playwright"),
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
