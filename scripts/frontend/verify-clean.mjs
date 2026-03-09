import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const npmCli = process.env.npm_execpath;
const warningPatterns = [
  /warning/i,
  /baseline-browser-mapping/i,
  /localstorage-file/i,
  /not wrapped in act/i,
  /width\(-1\)/i,
  /Unknown event handler property/i,
];

function resolveTasks() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const packageScripts = packageJson.scripts || {};
  return ["typecheck", "test:run", ...(packageScripts["check:hard-nav"] ? ["check:hard-nav"] : []), "build"];
}

function runTask(task) {
  return new Promise((resolve, reject) => {
    if (!npmCli) {
      reject(new Error("npm_execpath is not available in the environment"));
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(process.execPath, [npmCli, "run", task], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      process.stderr.write(text);
    });

    child.on("exit", (code) => {
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      if (code !== 0) {
        reject(new Error(`npm run ${task} failed with exit code ${code ?? 1}`));
        return;
      }

      if (stderr.trim().length > 0) {
        reject(new Error(`npm run ${task} emitted stderr output`));
        return;
      }

      const matchedPattern = warningPatterns.find((pattern) => pattern.test(stdout));
      if (matchedPattern) {
        reject(new Error(`npm run ${task} emitted warning output matching ${matchedPattern}`));
        return;
      }

      resolve(undefined);
    });
  });
}

for (const task of resolveTasks()) {
  await runTask(task);
}
