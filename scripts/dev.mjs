import { spawn, spawnSync } from "node:child_process";

const migration = spawnSync("php", ["api/db/migrate.php"], { stdio: "inherit" });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const env = { ...process.env, PURPLEROOM_ENV: "dev" };
const apiPort = process.env.GREEN_ROOM_API_PORT || "8000";
const children = [
  spawn("php", ["-S", `127.0.0.1:${apiPort}`, "-t", ".", "api/dev-router.php"], { stdio: "inherit", env }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)], { stdio: "inherit", env }),
];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
