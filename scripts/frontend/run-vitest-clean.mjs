import { spawn } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const vitestEntry = path.resolve(process.cwd(), "node_modules", "vitest", "vitest.mjs");

const rawNodeOptions = process.env.NODE_OPTIONS || "";
const sanitizedNodeOptions = rawNodeOptions
  .split(/\s+/)
  .filter(Boolean)
  .filter((token) => token !== "--localstorage-file" && !token.startsWith("--localstorage-file="))
  .join(" ");

const child = spawn(process.execPath, [vitestEntry, ...args], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: sanitizedNodeOptions,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
