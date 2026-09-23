import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { loadDotEnvLocal, getOptionalEnv } from "../media/src/config/environment.ts";
import { assessJourney } from "../media/src/cinematographer/assess-journey.ts";
import { plan } from "../media/src/director/plan-storyboard.ts";
import { deriveStory } from "../media/src/director/derive-story.ts";
import { ReplicateReasoningProvider } from "../media/src/replicate/reasoning.ts";
import { ReplicateMediaProvider } from "../media/src/replicate/provider.ts";
import { imageModelSlug } from "../media/src/replicate/image-models.ts";
import { resolveKlingV3Mode, videoModelSlug } from "../media/src/replicate/video-models.ts";
import { cameraGrammarFromUnknown, type CameraGrammar } from "../media/src/cinematographer/camera-grammar.ts";
import { createAppSettingsStore } from "./app-settings.ts";
import { renderCamotionShootingFrame } from "./camotion-cli.ts";
import { createCanonicalDepthCache } from "./camotion-depth.ts";
import { concatenateClipFiles, downloadClipToFile, prepareExportDirectory } from "./export-movie.ts";
import { createProjectStore, type ProjectStore } from "./project-store.ts";
import { createRuntimeMediaRegistry, getActiveRuntimeMediaRegistry, setActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import {
  constructDestinationImage,
  generateOpeningFrameImage,
} from "./destination-construct.ts";
import { shootPreparedJourney, stagePreparedMotionPlan, type JourneyShotTakeResult } from "./shoot-journey.ts";
import {
  cinematographerPairFromRequest,
  directorAnchorsFromRequest,
  directorStartFrameFromRequest,
  directorStoryboardFromRequest,
} from "./trusted-media.ts";
import { projectWithCameraGrammar } from "./src/project/camera-grammar.ts";
import { cinematographerRequestFromProject, projectWithCinematographerAssessment } from "./src/project/cinematographer.ts";
import { prepareDirectorPlan } from "./src/project/conversation.ts";
import {
  destinationConstructionRequestFromProject,
  destinationRepairRequestFromProject,
  imageModelIdFromBody,
  imageOutputFormatFromBody,
  imageResolutionFromBody,
  openingFrameGenerationRequestFromProject,
  projectWithConstructedDestination,
  projectWithGeneratedOpeningFrame,
  projectWithRepairedCanonical,
} from "./src/project/destination.ts";
import { directorPlanRequestFromProject, directorStoryRequestFromProject } from "./src/project/director.ts";
import {
  movieExportPlan,
  nextMovieExportFilename,
  type MovieExportResult,
} from "./src/project/export-movie.ts";
import { isGenerationIntent, type GenerationIntent } from "./src/project/generation-intent.ts";
import { runJourneyAgent, type JourneyAgentOperations, type JourneyAgentSnapshot } from "./src/project/journey-agent.ts";
import { effectiveJourneyPace } from "./src/project/journey-overrides.ts";
import { motionPlanStageRequestFromAssessment, projectWithMotionPlan } from "./src/project/motion-plan.ts";
import { createNewProject } from "./src/project/new-project.ts";
import { projectWithDefaultTakeIntent, projectWithJourneyShotTake, shootRequestFromProject } from "./src/project/shoot.ts";
import { projectWithDurationMode } from "./src/project/shot-duration.ts";
import { projectWithDirectorPlan } from "./src/project/storyboard.ts";
import type { JourneyShotTake, Project } from "./src/project/types.ts";

export type HeadlessJourneyLog = (message: string) => void;

export type HeadlessJourneyContext = {
  repoRoot: string;
  store: ProjectStore;
  projectRoot: string;
  log: HeadlessJourneyLog;
};

function optionalSeed(): number | undefined {
  const raw = getOptionalEnv("TUNNELVISION_VIDEO_SEED");
  if (!raw) {
    return undefined;
  }
  const seed = Number(raw);
  return Number.isInteger(seed) ? seed : undefined;
}

function takeFromShootResult(result: JourneyShotTakeResult): JourneyShotTake {
  return result as unknown as JourneyShotTake;
}

function imageProvider(project: Project): ReplicateMediaProvider {
  const imageModelId = imageModelIdFromBody(project.imageModel);
  const imageModel = imageModelSlug(imageModelId);
  const imageResolution = imageResolutionFromBody(imageModelId, project.imageResolution);
  return new ReplicateMediaProvider({
    imageModel,
    imageEditModel: imageModel,
    nanoBanana: {
      outputFormat: imageOutputFormatFromBody(imageModelId, project.imageOutputFormat),
      ...(imageResolution ? { resolution: imageResolution } : {}),
    },
  });
}

function videoProvider(project: Project, videoModel: Project["videoModel"], generateAudio: boolean): ReplicateMediaProvider {
  return new ReplicateMediaProvider({
    model: videoModelSlug(videoModel),
    generateAudio,
    pVideo: {
      draft: false,
      promptUpsampling: false,
      resolution: "720p",
      saveAudio: generateAudio,
      ...(optionalSeed() !== undefined ? { seed: optionalSeed() } : {}),
    },
    seedance: {
      generateAudio,
      resolution: "720p",
      aspectRatio: "adaptive",
      watermark: false,
      outputFormat: "mp4",
      ...(optionalSeed() !== undefined ? { seed: optionalSeed() } : {}),
    },
    klingV3: {
      mode: resolveKlingV3Mode(project.klingV3Mode),
      generateAudio,
    },
  });
}

export function createHeadlessJourneyOperations(input: {
  repoRoot: string;
  log?: HeadlessJourneyLog;
}): JourneyAgentOperations {
  const log = input.log ?? ((message) => process.stderr.write(`${message}\n`));
  const depthCache = createCanonicalDepthCache({ repoRoot: input.repoRoot });
  const renderFrame = (
    imagePath: string,
    plan: Parameters<typeof renderCamotionShootingFrame>[0]["plan"],
    mediaId: string,
  ) =>
    renderCamotionShootingFrame({
      repoRoot: input.repoRoot,
      imagePath,
      plan,
      mediaId,
      depthCache,
    });

  return {
    async generateOpening(project) {
      log("Generating opening still A");
      const request = openingFrameGenerationRequestFromProject(project);
      const provider = imageProvider(project);
      const result = await generateOpeningFrameImage({
        body: request,
        generateImage: (imageRequest) => provider.generateImage(imageRequest),
      });
      return projectWithGeneratedOpeningFrame(project, result);
    },
    async writeStoryFromOpening(project) {
      if (project.story.trim()) {
        return project;
      }
      log("Deriving journey story from opening still");
      const request = directorStoryRequestFromProject(project);
      const startFrame = directorStartFrameFromRequest(input.repoRoot, request as unknown as Record<string, unknown>);
      const result = await deriveStory({
        reasoning: new ReplicateReasoningProvider(),
        startFrame,
      });
      return { ...project, story: result.story };
    },
    async planJourney(project) {
      log("Director planning destinations");
      const prepared = prepareDirectorPlan(project);
      if (!prepared.ok) {
        throw new Error(
          prepared.reason === "invalid"
            ? (prepared.message ?? "Director planning failed")
            : "Director requires a filmmaker story",
        );
      }
      const body = directorPlanRequestFromProject(project) as unknown as Record<string, unknown>;
      const startFrame = directorStartFrameFromRequest(input.repoRoot, body);
      const anchors = directorAnchorsFromRequest(input.repoRoot, body);
      const storyboard = directorStoryboardFromRequest(body);
      const result = await plan({
        reasoning: new ReplicateReasoningProvider(),
        story: prepared.request.story,
        agency: prepared.request.agency,
        startFrame,
        ...(anchors ? { anchors } : {}),
        ...(storyboard ? { storyboard } : {}),
        ...(prepared.request.storyDuration !== undefined
          ? { storyDuration: prepared.request.storyDuration }
          : {}),
        cameraGrammar: cameraGrammarFromUnknown(prepared.request.cameraGrammar),
      });
      log(`Director planned ${result.plan.beats.length} subsequent destination(s)`);
      return { ...projectWithDirectorPlan(project, result.plan), agency: project.agency };
    },
    async constructDestination(project, beatId) {
      log(`Constructing destination ${beatId}`);
      const request = destinationConstructionRequestFromProject(project, beatId);
      const provider = imageProvider(project);
      const result = await constructDestinationImage({
        repoRoot: input.repoRoot,
        body: request,
        editImage: (imageRequest) => provider.editImage(imageRequest),
        generateImage: (imageRequest) => provider.generateImage(imageRequest),
      });
      return projectWithConstructedDestination(project, {
        beatId: request.beatId,
        mediaId: result.mediaId,
        imageUrl: result.imageUrl,
      });
    },
    async assessCinematographer(project, journeyId) {
      log(`Cinematographer assessing ${journeyId}`);
      const request = cinematographerRequestFromProject(project, journeyId);
      const pair = cinematographerPairFromRequest(input.repoRoot, request as unknown as Record<string, unknown>);
      const result = await assessJourney({
        reasoning: new ReplicateReasoningProvider(),
        journeyId: request.journeyId,
        story: request.story,
        start: pair.start,
        end: pair.end,
        cameraGrammar: cameraGrammarFromUnknown(request.cameraGrammar),
        pullForwardReferenceEnabled: request.pullForwardReferenceEnabled,
      });
      return projectWithCinematographerAssessment(project, journeyId, result.assessment, {
        startCanonicalMediaId: request.startMediaId,
        endCanonicalMediaId: request.endMediaId,
      });
    },
    async repairCanonical(project, beatId, repair) {
      log(`Repairing canonical ${beatId} (${repair.role})`);
      const request = destinationRepairRequestFromProject(project, beatId, repair);
      const provider = imageProvider(project);
      const result = await constructDestinationImage({
        repoRoot: input.repoRoot,
        body: request,
        editImage: (imageRequest) => provider.editImage(imageRequest),
      });
      return projectWithRepairedCanonical(project, {
        beatId: request.beatId,
        mediaId: result.mediaId,
        imageUrl: result.imageUrl,
      });
    },
    async planMotion(project, journeyId) {
      log(`Staging motion plan ${journeyId}`);
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey?.cinematographer) {
        throw new Error("Stage this journey before generating");
      }
      const request = cinematographerRequestFromProject(project, journeyId);
      const body = motionPlanStageRequestFromAssessment(
        journey.id,
        request.startMediaId,
        request.endMediaId,
        journey.cinematographer,
        {
          cameraGrammar: cameraGrammarFromUnknown(project.cameraGrammar),
          pace: effectiveJourneyPace(journey),
        },
      );
      const staged = await stagePreparedMotionPlan({
        repoRoot: input.repoRoot,
        body,
        renderFrame,
      });
      return projectWithMotionPlan(project, journeyId, {
        cinematographer: journey.cinematographer,
        startCanonicalMediaId: request.startMediaId,
        endCanonicalMediaId: request.endMediaId,
        startShootingFrame: staged.startShootingFrame,
        endShootingFrame: staged.endShootingFrame,
        startPlan: staged.startPlan,
        endPlan: staged.endPlan,
        segmentPromptAddition: staged.segmentPromptAddition,
        effectivePrompt: staged.effectivePrompt,
        pace: staged.pace,
        camotion: staged.camotion,
      });
    },
    async createTake(project, journeyId) {
      log(`Shooting ${journeyId}`);
      const request = shootRequestFromProject(project, journeyId);
      const provider = videoProvider(project, request.videoModel, request.generateAudio === true);
      const take = await shootPreparedJourney({
        repoRoot: input.repoRoot,
        body: request,
        renderFrame,
        generateVideo: (videoRequest) => provider.generateVideo(videoRequest),
      });
      return projectWithJourneyShotTake(project, journeyId, {
        take: takeFromShootResult(take),
        videoUrl: take.videoUrl,
      });
    },
    async assembleMovie(project) {
      log("Exporting combined movie");
      const exported = await exportHeadlessMovie(project);
      return { project, export: exported };
    },
  };
}

export async function exportHeadlessMovie(project: Project): Promise<MovieExportResult> {
  const plan = movieExportPlan(project);
  if (plan.included.length < 1) {
    throw new Error("Export Movie needs at least one rendered journey clip.");
  }
  const directory = await prepareExportDirectory();
  const clipPaths: string[] = [];
  const registry = getActiveRuntimeMediaRegistry();
  for (const [index, clip] of plan.included.entries()) {
    const dest = join(directory, `${String(index).padStart(2, "0")}-${clip.journeyId}.mp4`);
    const mediaId = clip.videoUrl.startsWith("/api/runtime-media/")
      ? clip.videoUrl.slice("/api/runtime-media/".length)
      : undefined;
    const local = mediaId ? registry?.get(mediaId)?.filePath : undefined;
    if (local) {
      clipPaths.push(local);
      continue;
    }
    if (/^https?:\/\//i.test(clip.videoUrl)) {
      await downloadClipToFile(clip.videoUrl, dest);
      clipPaths.push(dest);
      continue;
    }
    throw new Error(`Cannot resolve clip for ${clip.journeyId}`);
  }
  const filename = nextMovieExportFilename(project.title);
  const outputPath = join(directory, filename);
  const assembled = await concatenateClipFiles({ clipPaths, outputPath });
  const dropped = assembled.seamDrops.filter((seam) => seam.dropped);
  if (dropped.length > 0) {
    process.stderr.write(
      `drop-0: removed outgoing frame 0 on ${dropped.length} later take${dropped.length === 1 ? "" : "s"}\n`,
    );
  }
  return {
    videoUrl: outputPath,
    filename,
    complete: plan.missing.length === 0,
    includedJourneyIds: plan.included.map((clip) => clip.journeyId),
    missingJourneyIds: plan.missing.map((clip) => clip.journeyId),
  };
}

export async function resolveConfiguredProjectsFolder(repoRoot: string): Promise<string> {
  loadDotEnvLocal(repoRoot);
  const settings = await createAppSettingsStore().read();
  if (!settings.projectsFolder?.trim()) {
    throw new Error("No TunnelVision Projects Folder is configured. Set it in the app settings.");
  }
  return settings.projectsFolder.trim();
}

export function createHeadlessProject(input: {
  name: string;
  story: string;
  grammar: CameraGrammar;
  takeIntent?: GenerationIntent;
}): Project {
  const intent = input.takeIntent && isGenerationIntent(input.takeIntent) ? input.takeIntent : "quality";
  let project = createNewProject();
  project = {
    ...project,
    title: input.name,
    story: input.story,
    agency: "autonomous",
  };
  project = projectWithCameraGrammar(project, input.grammar);
  project = projectWithDurationMode(project, "adaptive");
  project = projectWithDefaultTakeIntent(project, intent);
  return project;
}

export async function saveHeadlessProject(input: {
  store: ProjectStore;
  projectRoot: string;
  project: Project;
  movieExport?: MovieExportResult | null;
}): Promise<Project> {
  const saved = await input.store.saveProject({
    projectRoot: input.projectRoot,
    project: input.project,
    movieExport: input.movieExport,
  });
  return saved.project;
}

export async function runHeadlessJourney(input: {
  repoRoot: string;
  name: string;
  story: string;
  grammar: CameraGrammar;
  takeIntent?: GenerationIntent;
  projectsFolder?: string;
  saveOnly?: boolean;
  log?: HeadlessJourneyLog;
  onSnapshot?: (snapshot: JourneyAgentSnapshot, project: Project) => void;
}): Promise<{
  project: Project;
  projectRoot: string;
  snapshot: JourneyAgentSnapshot;
  movieExport?: MovieExportResult;
}> {
  loadDotEnvLocal(input.repoRoot);
  const projectsFolder = input.projectsFolder ?? (await resolveConfiguredProjectsFolder(input.repoRoot));
  const runtimeDir = join(projectsFolder, ".tunnelvision-runtime");
  await mkdir(runtimeDir, { recursive: true });
  setActiveRuntimeMediaRegistry(createRuntimeMediaRegistry(runtimeDir));
  const store = createProjectStore({ repoRoot: input.repoRoot });
  const projectRoot = await store.createProjectDirectory(projectsFolder, input.name);
  let project = createHeadlessProject({
    name: input.name,
    story: input.story,
    grammar: input.grammar,
    takeIntent: input.takeIntent,
  });
  let movieExport: MovieExportResult | undefined;
  const persist = async (next: Project, exported?: MovieExportResult | null) => {
    project = await saveHeadlessProject({
      store,
      projectRoot,
      project: next,
      movieExport: exported ?? movieExport,
    });
    return project;
  };
  project = await persist(project);
  if (input.saveOnly) {
    return {
      project,
      projectRoot,
      snapshot: { phase: "IDLE", activity: null, events: [] },
    };
  }
  const base = createHeadlessJourneyOperations({
    repoRoot: input.repoRoot,
    log: input.log,
  });
  const operations: JourneyAgentOperations = {
    generateOpening: async (current) => persist(await base.generateOpening(current)),
    writeStoryFromOpening: async (current) => persist(await base.writeStoryFromOpening(current)),
    planJourney: async (current) => persist(await base.planJourney(current)),
    constructDestination: async (current, beatId) => persist(await base.constructDestination(current, beatId)),
    assessCinematographer: async (current, journeyId) =>
      persist(await base.assessCinematographer(current, journeyId)),
    repairCanonical: async (current, beatId, repair) =>
      persist(await base.repairCanonical(current, beatId, repair)),
    planMotion: async (current, journeyId) => persist(await base.planMotion(current, journeyId)),
    createTake: async (current, journeyId) => persist(await base.createTake(current, journeyId)),
    assembleMovie: async (current) => {
      const assembled = await base.assembleMovie(current);
      movieExport = assembled.export;
      const saved = await persist(assembled.project, assembled.export);
      return { project: saved, export: assembled.export };
    },
  };
  try {
    const result = await runJourneyAgent(project, operations, (snapshot) => {
      input.onSnapshot?.(snapshot, project);
      input.log?.(`[${snapshot.phase}] ${snapshot.activity?.message ?? snapshot.phase}`);
    });
    movieExport = result.movieExport ?? movieExport;
    project = await persist(result.project, result.movieExport);
    return {
      project,
      projectRoot,
      snapshot: result.snapshot,
      movieExport: result.movieExport ?? movieExport,
    };
  } catch (error) {
    await persist(project, movieExport).catch(() => undefined);
    const failureReason = error instanceof Error ? error.message : String(error);
    input.log?.(`FAILED ${failureReason}`);
    return {
      project,
      projectRoot,
      snapshot: {
        phase: "FAILED",
        activity: null,
        events: [],
        failureReason,
      },
      movieExport,
    };
  }
}

export async function writeHeadlessLog(filePath: string, lines: readonly string[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

export async function reexportSavedHeadlessProject(input: {
  repoRoot: string;
  projectRoot: string;
}): Promise<{ project: Project; projectRoot: string; movieExport: MovieExportResult }> {
  loadDotEnvLocal(input.repoRoot);
  const projectsFolder = await resolveConfiguredProjectsFolder(input.repoRoot);
  const runtimeDir = join(projectsFolder, ".tunnelvision-runtime");
  await mkdir(runtimeDir, { recursive: true });
  setActiveRuntimeMediaRegistry(createRuntimeMediaRegistry(runtimeDir));
  const store = createProjectStore({ repoRoot: input.repoRoot });
  const opened = await store.openProject(input.projectRoot);
  const movieExport = await exportHeadlessMovie(opened.project);
  const project = await saveHeadlessProject({
    store,
    projectRoot: input.projectRoot,
    project: opened.project,
    movieExport,
  });
  return { project, projectRoot: input.projectRoot, movieExport };
}
