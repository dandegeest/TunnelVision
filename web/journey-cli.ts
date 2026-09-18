import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { formatConfigCheck, loadDotEnvLocal } from "../media/src/config/environment.ts";
import { cameraGrammarFromUnknown, isCameraGrammar, type CameraGrammar } from "../media/src/cinematographer/camera-grammar.ts";
import { isGenerationIntent, type GenerationIntent } from "./src/project/generation-intent.ts";
import {
  reexportSavedHeadlessProject,
  resolveConfiguredProjectsFolder,
  runHeadlessJourney,
  writeHeadlessLog,
} from "./headless-journey.ts";
import { canonicalTakes } from "./src/project/canonical-takes.ts";
import type { MovieExportResult } from "./src/project/export-movie.ts";
import { journeyTakes } from "./src/project/takes.ts";
import type { Project } from "./src/project/types.ts";
import type { JourneyAgentSnapshot } from "./src/project/journey-agent.ts";

const webDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(webDir, "..");

export const CANYON_PROMPTS: Record<CameraGrammar, { name: string; prompt: string }> = {
  pov: {
    name: "Grammar Test - POV Canyon Run",
    prompt: `Photorealistic cinematic POV high-speed journey through a dramatic desert canyon.

Race along an open desert highway toward towering red-rock cliffs, enter a twisting canyon road, plunge through a narrow rock tunnel, cross a high bridge above a deep gorge, and emerge onto a spectacular open mountain road overlooking the desert.

The camera is the traveler. Maintain continuous physical travel through the entire route, naturally turning and banking as the road changes direction.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.

Do not show a cockpit, vehicle body, driver, hands, hood, or other persistent foreground rig.`,
  },
  follow: {
    name: "Grammar Test - FOLLOW Canyon Run",
    prompt: `Photorealistic cinematic FOLLOW journey tracking the same bright red sports car at high speed through a dramatic desert canyon.

Follow the car along an open desert highway toward towering red-rock cliffs, through a twisting canyon road, into a narrow rock tunnel, across a high bridge above a deep gorge, and finally onto a spectacular open mountain road overlooking the desert.

The red car remains the persistent subject and continuity anchor throughout.

The invisible objective camera stays in pursuit while allowing natural cinematic variation in distance and framing as the car accelerates, pulls ahead, banks through turns and moves through the changing landscape.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.`,
  },
  lead: {
    name: "Grammar Test - LEAD Canyon Run",
    prompt: `Photorealistic cinematic LEAD journey with the same bright red sports car racing toward the camera through a dramatic desert canyon.

Stay ahead of the car while continuously facing it as it races along an open desert highway toward towering red-rock cliffs, enters a twisting canyon road, passes through a narrow rock tunnel, crosses a high bridge above a deep gorge, and reaches a spectacular open mountain road overlooking the desert.

The red car remains the persistent subject and continuity anchor throughout.

The invisible objective camera retreats ahead of the approaching car, preserving the lead relationship while moving naturally through the same physical route.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.`,
  },
  mounted: {
    name: "Grammar Test - MOUNTED Canyon Run",
    prompt: `Photorealistic cinematic MOUNTED journey attached to the same bright red sports car during a high-speed run through a dramatic desert canyon.

Travel with the car along an open desert highway toward towering red-rock cliffs, through a twisting canyon road, into a narrow rock tunnel, across a high bridge above a deep gorge, and finally onto a spectacular open mountain road overlooking the desert.

The camera is physically mounted to the moving car and inherits its acceleration, turns, banking and vibration. A small amount of persistent vehicle geometry may remain visible when natural to the mounted perspective.

High-end live-action automotive cinematography, realistic terrain, natural light, extreme speed and monumental scale.`,
  },
};

type CliOptions = {
  name?: string;
  grammar?: string;
  takeIntent?: string;
  prompt?: string;
  promptFile?: string;
  saveOnly?: boolean;
  experimentCanyon?: boolean;
  exportProject?: string;
  logDir?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    if (arg === "--save-only") {
      options.saveOnly = true;
      continue;
    }
    if (arg === "--experiment-canyon") {
      options.experimentCanyon = true;
      continue;
    }
    if (!next) {
      continue;
    }
    if (arg === "--name") {
      options.name = next;
      index += 1;
    } else if (arg === "--grammar") {
      options.grammar = next;
      index += 1;
    } else if (arg === "--take-intent") {
      options.takeIntent = next;
      index += 1;
    } else if (arg === "--prompt") {
      options.prompt = next;
      index += 1;
    } else if (arg === "--prompt-file") {
      options.promptFile = next;
      index += 1;
    } else if (arg === "--log-dir") {
      options.logDir = next;
      index += 1;
    } else if (arg === "--export-project") {
      options.exportProject = next;
      index += 1;
    }
  }
  return options;
}

export type JourneyRunRecord = {
  name: string;
  grammar: CameraGrammar;
  prompt: string;
  projectRoot?: string;
  snapshot?: JourneyAgentSnapshot;
  movieExport?: MovieExportResult;
  project?: Project;
  error?: string;
};

function summarizeProject(project: Project | undefined): Record<string, unknown> {
  if (!project) {
    return {};
  }
  const selectedTakes = project.journeys.map((journey) => {
    const takes = journeyTakes(journey);
    const selected = takes.find((take) => take.videoUrl === journey.videoUrl) ?? takes[takes.length - 1];
    return {
      id: journey.id,
      pace: journey.cinematographer?.pace,
      desiredDurationSeconds: journey.cinematographer?.desiredDurationSeconds,
      actualDurationSeconds: selected?.durationSeconds ?? journey.durationSeconds,
      model: selected?.model,
      generationIntent: selected?.generationIntent,
      takeCount: takes.length,
    };
  });
  return {
    canonicals: project.storyboard.filter((frame) => frame.imageOrigin !== "none").length,
    destinations: project.storyboard.length,
    traversals: project.journeys.filter((journey) => journey.endDestinationId).length,
    canonicalReshoots: project.storyboard.reduce((sum, frame) => sum + Math.max(0, canonicalTakes(frame).length - 1), 0),
    traversalRetries: project.journeys.reduce((sum, journey) => sum + Math.max(0, journeyTakes(journey).length - 1), 0),
    takes: project.journeys.reduce((sum, journey) => sum + journeyTakes(journey).length, 0),
    desiredDurations: selectedTakes,
    totalFinalDurationSeconds: selectedTakes.reduce(
      (sum, take) => sum + (typeof take.actualDurationSeconds === "number" ? take.actualDurationSeconds : 0),
      0,
    ),
    shootErrors: project.journeys
      .filter((journey) => journey.shootError)
      .map((journey) => ({ id: journey.id, error: journey.shootError })),
  };
}

export async function runCanyonGrammarExperiment(input: {
  repoRoot?: string;
  saveOnly?: boolean;
  logDir?: string;
  grammars?: readonly CameraGrammar[];
}): Promise<{ records: JourneyRunRecord[]; logDir: string }> {
  const root = input.repoRoot ?? repoRoot;
  loadDotEnvLocal(root);
  const logDir = input.logDir ?? join(root, "docs", "grammar_experiment", "logs");
  await mkdir(logDir, { recursive: true });
  const records: JourneyRunRecord[] = [];
  const grammars = input.grammars ?? (["pov", "follow", "lead", "mounted"] as const);
  for (const grammar of grammars) {
    const spec = CANYON_PROMPTS[grammar];
    const lines: string[] = [`${new Date().toISOString()} grammar=${grammar} name=${spec.name}`];
    const log = (message: string) => {
      const line = `${new Date().toISOString()} ${message}`;
      lines.push(line);
      process.stderr.write(`${line}\n`);
    };
    try {
      const result = await runHeadlessJourney({
        repoRoot: root,
        name: spec.name,
        story: spec.prompt,
        grammar,
        takeIntent: "quality",
        saveOnly: input.saveOnly,
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
    const projectsFolder = await resolveConfiguredProjectsFolder(root);
    const report = formatGrammarExperimentReport({
      records,
      logDir,
      projectsFolder,
      credentialsOk: true,
      headless: true,
      saveOnly: input.saveOnly,
    });
    await writeFile(join(root, "docs", "grammar_experiment_report.md"), report, "utf8");
  }
  return { records, logDir };
}

export function formatGrammarExperimentReport(input: {
  records: readonly JourneyRunRecord[];
  logDir: string;
  projectsFolder: string;
  credentialsOk: boolean;
  headless: boolean;
  saveOnly?: boolean;
}): string {
  const completed = input.records.filter((record) => record.snapshot?.phase === "COMPLETE");
  const failed = input.records.filter((record) => record.error || record.snapshot?.phase === "FAILED");
  const headlessStatus =
    input.records.length === 0
      ? "FAILED"
      : failed.length === 0 && completed.length === input.records.length
        ? "SUCCESS"
        : completed.length > 0 || input.records.some((record) => record.projectRoot)
          ? "PARTIAL"
          : "FAILED";
  const lines = [
    "# Grammar experiment report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## HEADLESS EXECUTION",
    "",
    headlessStatus,
    "",
    input.headless
      ? "Journeys were created through the non-interactive `runJourneyAgent` path (`web/headless-journey.ts` / `web/journey-cli.ts`), not the browser UI."
      : "Headless orchestration was not used.",
    input.saveOnly ? "This run used `--save-only` and did not generate media." : "",
    `Projects Folder: ${input.projectsFolder}`,
    `Credentials: ${input.credentialsOk ? "REPLICATE_API_TOKEN configured" : "REPLICATE_API_TOKEN missing"}`,
    `Logs: ${input.logDir}`,
    "",
  ];
  for (const record of input.records) {
    const summary = summarizeProject(record.project);
    const exportPath =
      record.movieExport?.filename && record.projectRoot
        ? join(record.projectRoot, "exports", record.movieExport.filename)
        : record.movieExport?.videoUrl;
    lines.push(`## ${record.name}`, "");
    lines.push(`- Project name: ${record.name}`);
    lines.push(`- Project directory: ${record.projectRoot ?? "(not created)"}`);
    lines.push(`- grammar: ${record.grammar}`);
    lines.push("- original journey prompt:");
    lines.push("");
    lines.push("```");
    lines.push(record.prompt.trim());
    lines.push("```");
    lines.push("");
    lines.push(`- journey status: ${record.snapshot?.phase ?? (record.error ? "FAILED" : "unknown")}`);
    lines.push(`- number of canonicals: ${summary.canonicals ?? "n/a"}`);
    lines.push(`- number of traversals: ${summary.traversals ?? "n/a"}`);
    lines.push(`- canonical reshoots: ${summary.canonicalReshoots ?? "n/a"}`);
    lines.push(`- traversal retries/reshoots: ${summary.traversalRetries ?? "n/a"}`);
    lines.push(`- takes: ${summary.takes ?? "n/a"}`);
    lines.push(`- CM desired / actual durations: ${JSON.stringify(summary.desiredDurations ?? [])}`);
    lines.push(`- quality model(s) used: ${JSON.stringify((summary.desiredDurations as Array<{ model?: string }> | undefined)?.map((item) => item.model) ?? [])}`);
    lines.push(`- final export path: ${exportPath ?? "(none)"}`);
    lines.push(`- total final journey duration: ${summary.totalFinalDurationSeconds ?? "n/a"}s`);
    lines.push(`- errors/warnings: ${record.error ?? JSON.stringify(summary.shootErrors ?? [])}`);
    if (record.snapshot?.failureReason) {
      lines.push(`- agent failure: ${record.snapshot.failureReason}`);
    }
    lines.push(`- execution notes: ${record.snapshot?.events.map((event) => event.activity).join(" | ") || "none"}`);
    lines.push("");
  }
  return `${lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadDotEnvLocal(repoRoot);
  const credentials = formatConfigCheck();
  process.stderr.write(credentials.text);
  const projectsFolder = await resolveConfiguredProjectsFolder(repoRoot);
  process.stderr.write(`Projects Folder: ${projectsFolder}\n`);
  const logDir = options.logDir
    ? isAbsolute(options.logDir)
      ? options.logDir
      : resolve(repoRoot, options.logDir)
    : join(repoRoot, "docs", "grammar_experiment", "logs");

  if (options.exportProject) {
    const projectRoot = isAbsolute(options.exportProject)
      ? options.exportProject
      : resolve(projectsFolder, options.exportProject);
    const exported = await reexportSavedHeadlessProject({ repoRoot, projectRoot });
    process.stdout.write(`${join(exported.projectRoot, "exports", exported.movieExport.filename)}\n`);
    return;
  }

  if (options.experimentCanyon) {
    const { records, logDir: usedLogDir } = await runCanyonGrammarExperiment({
      repoRoot,
      saveOnly: options.saveOnly,
      logDir,
    });
    const report = formatGrammarExperimentReport({
      records,
      logDir: usedLogDir,
      projectsFolder,
      credentialsOk: credentials.ok,
      headless: true,
      saveOnly: options.saveOnly,
    });
    const reportPath = join(repoRoot, "docs", "grammar_experiment_report.md");
    await writeFile(reportPath, report, "utf8");
    process.stdout.write(`${reportPath}\n`);
    if (!options.saveOnly && records.some((record) => record.error || record.snapshot?.phase === "FAILED")) {
      process.exitCode = 1;
    }
    return;
  }

  const grammar = cameraGrammarFromUnknown(options.grammar);
  if (options.grammar && !isCameraGrammar(options.grammar)) {
    throw new Error(`Unknown camera grammar: ${options.grammar}`);
  }
  const takeIntent: GenerationIntent = isGenerationIntent(options.takeIntent) ? options.takeIntent : "quality";
  const prompt =
    options.prompt?.trim() ||
    (options.promptFile
      ? (await readFile(isAbsolute(options.promptFile) ? options.promptFile : resolve(process.cwd(), options.promptFile), "utf8")).trim()
      : CANYON_PROMPTS[grammar].prompt);
  const name = options.name?.trim() || CANYON_PROMPTS[grammar].name;
  const lines: string[] = [];
  const result = await runHeadlessJourney({
    repoRoot,
    name,
    story: prompt,
    grammar,
    takeIntent,
    saveOnly: options.saveOnly,
    log: (message) => {
      const line = `${new Date().toISOString()} ${message}`;
      lines.push(line);
      process.stderr.write(`${line}\n`);
    },
  });
  await mkdir(logDir, { recursive: true });
  await writeHeadlessLog(join(logDir, `${grammar}.log`), lines);
  process.stdout.write(`${result.projectRoot}\n`);
  if (result.movieExport?.filename) {
    process.stdout.write(`${join(result.projectRoot, "exports", result.movieExport.filename)}\n`);
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
