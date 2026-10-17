import { spawn } from "node:child_process";
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  stdio: "inherit",
  env: { ...process.env, HOST: "127.0.0.1", PORT: process.env.PORT || "5173", LABOR_ENCRYPT_DATA: process.env.LABOR_ENCRYPT_DATA || "1" },
});
child.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
