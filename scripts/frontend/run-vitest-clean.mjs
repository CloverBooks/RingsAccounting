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

function createFilteredWriter(output) {
  let buffer = "";
  let suppressTraceLine = false;

  function flushChunk(text, allowPartial = false) {
    buffer += text;
    const lines = buffer.split(/\r?\n/);
    if (!allowPartial) {
      buffer = "";
    } else {
      buffer = lines.pop() ?? "";
    }

    for (const line of lines) {
      if (line.includes("`--localstorage-file` was provided without a valid path")) {
        suppressTraceLine = true;
        continue;
      }
      if (suppressTraceLine && line.includes("node --trace-warnings")) {
        suppressTraceLine = false;
        continue;
      }
      suppressTraceLine = false;
      output.write(`${line}\n`);
    }
  }

  return {
    write(chunk) {
      flushChunk(chunk.toString(), true);
    },
    end() {
      if (buffer.length > 0) {
        flushChunk("", false);
      }
    },
  };
}

const child = spawn(process.execPath, [vitestEntry, ...args], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NODE_OPTIONS: sanitizedNodeOptions,
    npm_config_node_options: "",
    npm_config_localstorage_file: "",
  },
});

const stdoutWriter = createFilteredWriter(process.stdout);
const stderrWriter = createFilteredWriter(process.stderr);

child.stdout.on("data", (chunk) => stdoutWriter.write(chunk));
child.stderr.on("data", (chunk) => stderrWriter.write(chunk));

child.on("exit", (code, signal) => {
  stdoutWriter.end();
  stderrWriter.end();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
