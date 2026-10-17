import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "green-room-ui-"));
const env = { ...process.env, GREEN_ROOM_ENV: "dev", GREEN_ROOM_DB: join(directory, "db.sqlite") };
for (const args of [["api/db/migrate.php"], ["api/db/seed.php", "Nico", "ui-test@example.com"]]) {
  const result = spawnSync("php", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const child = spawn(process.execPath, ["scripts/dev.mjs", "--port", "5179", "--strictPort"], { env, stdio: "inherit" });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGTERM"));
child.on("exit", (code) => { rmSync(directory, { recursive: true, force: true }); process.exit(code ?? 0); });
