import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  formatConfigCheck,
  loadDotEnvLocal,
} from "../config/environment.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

loadDotEnvLocal(repoRoot);
const result = formatConfigCheck();
process.stdout.write(result.text);
process.exit(result.ok ? 0 : 1);
