import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  describeEnv,
  formatConfigCheck,
  getOptionalEnv,
  getRequiredEnv,
  loadDotEnvLocal,
  MissingEnvironmentVariableError,
} from "../src/config/environment.ts";

test("required environment variable is returned when present", () => {
  const source = { REPLICATE_API_TOKEN: "secret-value" };
  assert.equal(getRequiredEnv("REPLICATE_API_TOKEN", source), "secret-value");
  assert.equal(describeEnv("REPLICATE_API_TOKEN", source), "configured");
});

test("required environment variable missing throws without leaking other secrets", () => {
  const source = { OTHER: "not-the-token" };
  assert.throws(
    () => getRequiredEnv("REPLICATE_API_TOKEN", source),
    (error: unknown) => {
      assert(error instanceof MissingEnvironmentVariableError);
      assert.equal(error.variable, "REPLICATE_API_TOKEN");
      assert.equal(error.message, "REPLICATE_API_TOKEN is not set");
      assert.equal(String(error).includes("not-the-token"), false);
      return true;
    },
  );
  assert.equal(describeEnv("REPLICATE_API_TOKEN", source), "missing");
  assert.equal(getOptionalEnv("REPLICATE_API_TOKEN", source), undefined);
});

test("shell environment takes precedence over .env.local", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-env-"));
  await writeFile(join(dir, ".env.local"), "REPLICATE_API_TOKEN=from-file\nOTHER=file-only\n");
  const source: Record<string, string | undefined> = {
    REPLICATE_API_TOKEN: "from-shell",
  };
  loadDotEnvLocal(dir, source);
  assert.equal(source.REPLICATE_API_TOKEN, "from-shell");
  assert.equal(source.OTHER, "file-only");
});

test(".env.local can supply missing local configuration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tv-env-fill-"));
  await writeFile(join(dir, ".env.local"), "REPLICATE_API_TOKEN=from-file\n");
  const source: Record<string, string | undefined> = {};
  loadDotEnvLocal(dir, source);
  assert.equal(getRequiredEnv("REPLICATE_API_TOKEN", source), "from-file");
});

test("config check reports presence without values", () => {
  const missing = formatConfigCheck({});
  assert.equal(missing.ok, false);
  assert.match(missing.text, /REPLICATE_API_TOKEN: missing/);
  assert.equal(missing.text.includes("from-file"), false);

  const configured = formatConfigCheck({ REPLICATE_API_TOKEN: "secret-value" });
  assert.equal(configured.ok, true);
  assert.match(configured.text, /REPLICATE_API_TOKEN: configured/);
  assert.equal(configured.text.includes("secret-value"), false);
});
