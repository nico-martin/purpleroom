import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function productionConfig(environment) {
  let url;
  try {
    url = new URL(environment.APP_BASE_URL);
  } catch {
    throw new Error("Set APP_BASE_URL to the production HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "APP_BASE_URL must be an HTTPS origin without credentials, a path, query, or fragment."
    );
  }

  const mailFrom = environment.APP_MAIL_FROM || "Green Room <noreply@nico.dev>";
  const address = mailFrom.match(/<([^<>]+)>$/)?.[1] ?? mailFrom;
  if (
    /[\x00-\x1f\x7f]/.test(mailFrom) ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
  ) {
    throw new Error(
      "APP_MAIL_FROM must be an email address or display-name mailbox without control characters."
    );
  }

  const setupKey = environment.APP_SETUP_KEY || null;
  if (
    setupKey !== null &&
    (setupKey.length < 32 || /[\x00-\x1f\x7f]/.test(setupKey))
  ) {
    throw new Error(
      "APP_SETUP_KEY must contain at least 32 random characters and no control characters, or be unset to disable setup."
    );
  }

  return {
    env: "production",
    base_url: url.origin,
    mail_from: mailFrom,
    setup_key: setupKey,
  };
}

function phpLiteral(value) {
  if (value === null) return "null";
  return "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
}

export function renderConfig(config) {
  return (
    "<?php\ndeclare(strict_types=1);\n\n// Generated from GitHub Actions secrets. Do not edit on the server.\nreturn [\n" +
    Object.entries(config)
      .map(([key, value]) => `    '${key}' => ${phpLiteral(value)},`)
      .join("\n") +
    "\n];\n"
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const destination = process.argv[2];
    if (!destination)
      throw new Error(
        "Provide the deployment bundle's config.local.php destination."
      );
    const config = productionConfig(process.env);
    await writeFile(destination, renderConfig(config), { mode: 0o600 });
  } catch (error) {
    // Validation errors contain setting names, never their secret values.
    console.error(
      error instanceof Error
        ? error.message
        : "Could not generate production config."
    );
    process.exitCode = 1;
  }
}
