import { defineConfig } from "@playwright/test";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
// Each invocation gets a fresh local database; never clean or reuse user materials.
const testData = root + "/tests/generated/e2e-data/" + Date.now();
const apiPort = 18001;
const uiPort = 15174;
export default defineConfig({
  testDir: "../tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["json", { outputFile: "../docs/e2e-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:" + uiPort,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        '"' +
        root +
        '/backend/.venv/Scripts/python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port ' +
        apiPort,
      cwd: root + "/backend",
      url: "http://127.0.0.1:" + apiPort + "/health",
      reuseExistingServer: false,
      env: {
        JINGGAO_DATA_DIR: testData,
        PYTHONUTF8: "1",
      },
      timeout: 60000,
    },
    {
      // Launch Vite directly: avoid npm.cmd's intermediate shell losing its
      // stdio/session when Playwright replaces a failed Windows worker.
      command:
        '"' +
        process.execPath +
        '" node_modules/vite/bin/vite.js --host 127.0.0.1 --port ' +
        uiPort,
      url: "http://127.0.0.1:" + uiPort,
      reuseExistingServer: false,
      // Vite otherwise treats EOF on a Windows automation pipe as SIGTERM.
      env: { CI: "true", JINGGAO_API_ORIGIN: "http://127.0.0.1:" + apiPort },
    },
  ],
  projects: [
    {
      name: "edge-file-picker",
      testMatch: /file-input\.spec\.ts/,
      use: { channel: "msedge", viewport: { width: 1440, height: 900 } },
    },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "desktop-1366", use: { viewport: { width: 1366, height: 768 } } },
  ],
});
