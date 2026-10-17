import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "green-room-ui-"));
// This key is used only by an isolated, loopback-only throwaway test server.
const env = { ...process.env, GREEN_ROOM_ENV: "dev", GREEN_ROOM_DB: join(directory, "db.sqlite"), GREEN_ROOM_API_PORT: "8019", GREEN_ROOM_SETUP_KEY: "green-room-browser-test-key-not-for-production" };
const child = spawn(process.execPath, ["scripts/dev.mjs", "--port", "5179", "--strictPort"], { env, stdio: "inherit" });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGTERM"));
child.on("exit", (code) => { rmSync(directory, { recursive: true, force: true }); process.exit(code ?? 0); });
