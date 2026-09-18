import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { formatConfigCheck, loadDotEnvLocal } from "../media/src/config/environment.ts";
import type { CameraGrammar } from "../media/src/cinematographer/camera-grammar.ts";
import {
  formatGrammarExperimentReport,
  type JourneyRunRecord,
} from "./journey-cli.ts";
import { resolveConfiguredProjectsFolder, runHeadlessJourney, writeHeadlessLog } from "./headless-journey.ts";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "..");

/** FM-only canyon prompts: subject, beats, style. Grammar comes from CAMERA. */
export const CANYON_TEMPLATE_PROMPTS: Record<CameraGrammar, { name: string; prompt: string }> = {
  pov: {
    name: "Grammar Template Test - POV Canyon Run",
    prompt: `Photorealistic high-speed journey through a dramatic desert canyon:
open highway toward towering red-rock cliffs, twisting canyon road,
narrow rock tunnel, high bridge over a deep gorge, then an open
mountain road overlooking the desert.

High-end live-action cinematography, natural light, monumental scale.`,
  },
  follow: {
    name: "Grammar Template Test - FOLLOW Canyon Run",
    prompt: `Photorealistic high-speed journey tracking the same bright red sports car
through a dramatic desert canyon: open highway toward towering red-rock
cliffs, twisting canyon road, narrow rock tunnel, high bridge over a deep
gorge, then an open mountain road overlooking the desert.

High-end live-action automotive cinematography, natural light,
monumental scale.`,
  },
  lead: {
    name: "Grammar Template Test - LEAD Canyon Run",
    prompt: `Photorealistic high-speed journey with the same bright red sports car
through a dramatic desert canyon: open highway toward towering red-rock
cliffs, twisting canyon road, narrow rock tunnel, high bridge over a deep
gorge, then an open mountain road overlooking the desert.

High-end live-action automotive cinematography, natural light,
monumental scale.`,
  },
  mounted: {
    name: "Grammar Template Test - MOUNTED Canyon Run",
    prompt: `Photorealistic high-speed journey with the same bright red sports car
through a dramatic desert canyon: open highway toward towering red-rock
cliffs, twisting canyon road, narrow rock tunnel, high bridge over a deep
gorge, then an open mountain road overlooking the desert.

High-end live-action automotive cinematography, natural light,
monumental scale.`,
  },
};

async function main() {
  loadDotEnvLocal(repoRoot);
  const credentials = formatConfigCheck();
  process.stderr.write(credentials.text);
  const projectsFolder = await resolveConfiguredProjectsFolder(repoRoot);
  process.stderr.write(`Projects Folder: ${projectsFolder}\n`);
  const logDir = join(repoRoot, "docs", "grammar_template_experiment", "logs");
  await mkdir(logDir, { recursive: true });
  const records: JourneyRunRecord[] = [];
  const grammars = ["pov", "follow", "lead", "mounted"] as const;
  for (const grammar of grammars) {
    const spec = CANYON_TEMPLATE_PROMPTS[grammar];
    const lines: string[] = [`${new Date().toISOString()} grammar=${grammar} name=${spec.name} takeIntent=quality duration=adaptive`];
    const log = (message: string) => {
      const line = `${new Date().toISOString()} ${message}`;
      lines.push(line);
      process.stderr.write(`${line}\n`);
    };
    try {
      const result = await runHeadlessJourney({
        repoRoot,
        name: spec.name,
        story: spec.prompt,
        grammar,
        takeIntent: "quality",
        log,
      });
      const error =
        result.snapshot.phase === "FAILED"
          ? result.snapshot.failureReason ?? "JourneyAgent failed"
          : undefined;
      records.push({
        name: spec.name,
        grammar,
        prompt: spec.prompt,
        projectRoot: result.projectRoot,
        snapshot: result.snapshot,
        movieExport: result.movieExport,
        project: result.project,
        error,
      });
      lines.push(`status=${result.snapshot.phase}`);
      lines.push(`projectRoot=${result.projectRoot}`);
      if (error) {
        lines.push(`error=${error}`);
      }
      if (result.movieExport?.filename) {
        lines.push(`export=${result.movieExport.filename} complete=${result.movieExport.complete}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`FAILED ${message}`);
      records.push({
        name: spec.name,
        grammar,
        prompt: spec.prompt,
        error: message,
      });
    }
    await writeHeadlessLog(join(logDir, `${grammar}.log`), lines);
    const partial = formatGrammarExperimentReport({
      records,
      logDir,
      projectsFolder,
      credentialsOk: credentials.ok,
      headless: true,
    });
    await writeFile(join(logDir, "partial-report.md"), partial, "utf8");
  }
  process.stdout.write(`${JSON.stringify(records.map((record) => ({
    grammar: record.grammar,
    name: record.name,
    projectRoot: record.projectRoot,
    status: record.snapshot?.phase,
    error: record.error,
    export: record.movieExport?.filename,
  })), null, 2)}\n`);
  if (records.some((record) => record.error || record.snapshot?.phase === "FAILED")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
