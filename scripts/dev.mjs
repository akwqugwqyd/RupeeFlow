import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function start(name, project, entryPoint, args) {
  const child = spawn(process.execPath, [path.join(root, entryPoint), ...args], {
    cwd: path.join(root, project),
    stdio: "inherit",
    windowsHide: true
  });
  child.on("error", (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });
  return child;
}

const processes = [
  start("server", "server", "server/node_modules/tsx/dist/cli.mjs", ["watch", "src/server.ts"]),
  start("client", "client", "client/node_modules/vite/bin/vite.js", ["--host", "0.0.0.0"])
];
let stopping = false;

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

for (const child of processes) {
  child.on("exit", (code, signal) => {
    if (stopping) return;
    if (signal) console.error(`A development process stopped with signal ${signal}.`);
    shutdown(code ?? 1);
  });
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
