import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { directorDevPlugin } from "./director-dev-plugin.ts";
import { runtimeMediaPlugin } from "./runtime-media-plugin.ts";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "..");

export default defineConfig({
  plugins: [react(), tailwindcss(), directorDevPlugin(repoRoot), runtimeMediaPlugin()],
  root: webDir,
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  ssr: {
    external: ["replicate"],
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "trusted-media.test.ts",
      "runtime-media.test.ts",
    ],
  },
});
