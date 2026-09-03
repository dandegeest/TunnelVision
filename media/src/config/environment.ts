import { readFileSync } from "node:fs";
import { join } from "node:path";

export type EnvSource = Record<string, string | undefined>;

export class MissingEnvironmentVariableError extends Error {
  readonly name = "MissingEnvironmentVariableError";
  readonly variable: string;

  constructor(variable: string) {
    super(`${variable} is not set`);
    this.variable = variable;
  }
}

export function parseDotEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Fill missing process.env keys from repo-root .env.local.
 * Already-set shell/deployment values are never overwritten.
 */
export function loadDotEnvLocal(
  repoRoot: string,
  source: EnvSource = process.env,
): void {
  let text: string;
  try {
    text = readFileSync(join(repoRoot, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(parseDotEnv(text))) {
    if (source[key] === undefined) {
      source[key] = value;
    }
  }
}

export function getOptionalEnv(
  name: string,
  source: EnvSource = process.env,
): string | undefined {
  const value = source[name];
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
}

export function getRequiredEnv(
  name: string,
  source: EnvSource = process.env,
): string {
  const value = getOptionalEnv(name, source);
  if (value === undefined) {
    throw new MissingEnvironmentVariableError(name);
  }
  return value;
}

export type EnvPresence = "configured" | "missing";

export function describeEnv(
  name: string,
  source: EnvSource = process.env,
): EnvPresence {
  return getOptionalEnv(name, source) === undefined ? "missing" : "configured";
}

export const MEDIA_CREDENTIAL_NAMES = ["REPLICATE_API_TOKEN"] as const;

export function formatConfigCheck(
  source: EnvSource = process.env,
): { readonly text: string; readonly ok: boolean } {
  const lines = ["TunnelVision media configuration", ""];
  let ok = true;
  for (const name of MEDIA_CREDENTIAL_NAMES) {
    const status = describeEnv(name, source);
    if (status === "missing") {
      ok = false;
    }
    lines.push(`${name}: ${status}`);
  }
  if (!ok) {
    lines.push("");
    lines.push(
      "Supply missing values via the environment or repo-root .env.local.",
    );
  }
  return { text: lines.join("\n") + "\n", ok };
}
