import { defineConfig } from "@playwright/test";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
// Each invocation gets a fresh local database; never clean or reuse user materials.
const testData = root + "/tests/generated/e2e-data/" + Date.now();
export default defineConfig({
  testDir: "../tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["json", { outputFile: "../docs/e2e-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        '"' +
        root +
        '/backend/.venv/Scripts/python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001',
      cwd: root + "/backend",
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      env: {
        JINGGAO_DATA_DIR: testData,
        PYTHONUTF8: "1",
      },
      timeout: 60000,
    },
    {
      command: "npm.cmd run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { JINGGAO_API_ORIGIN: "http://127.0.0.1:8001" },
    },
  ],
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "desktop-1366", use: { viewport: { width: 1366, height: 768 } } },
  ],
});
