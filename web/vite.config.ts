import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { directorDevPlugin } from "./director-dev-plugin.ts";
import { destinationDevPlugin } from "./destination-dev-plugin.ts";
import { cinematographerDevPlugin } from "./cinematographer-dev-plugin.ts";
import { shootDevPlugin } from "./shoot-dev-plugin.ts";
import { runtimeMediaPlugin } from "./runtime-media-plugin.ts";
import { exportMoviePlugin } from "./export-movie-plugin.ts";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "..");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    directorDevPlugin(repoRoot),
    destinationDevPlugin(repoRoot),
    cinematographerDevPlugin(repoRoot),
    shootDevPlugin(repoRoot),
    runtimeMediaPlugin(),
    exportMoviePlugin(),
  ],
  root: webDir,
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  ssr: {
    external: ["replicate", "sharp"],
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "trusted-media.test.ts",
      "runtime-media.test.ts",
      "destination-construct.test.ts",
      "shoot-journey.test.ts",
      "camotion-cli.test.ts",
      "export-movie.test.ts",
    ],
  },
});
