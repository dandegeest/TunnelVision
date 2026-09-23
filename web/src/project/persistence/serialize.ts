import { canonicalTakes } from "../canonical-takes";
import { conversationTimestamp } from "../conversation";
import type { ConversationEntry } from "../conversation";
import type { MovieExportResult } from "../export-movie";
import { createNewProject } from "../new-project";
import { projectWithSyncedProductionLegs } from "../production-legs";
import { isLocomotionPace } from "../../../../media/src/cinematographer/shooting-prompt.ts";
import { cameraGrammarFromProject, cameraGrammarFromUnknown } from "../camera-grammar";
import {
  DEFAULT_DURATION_MODE,
  DEFAULT_FIXED_DURATION_SECONDS,
  clampDurationSeconds,
  durationModeFromProject,
  fixedDurationSecondsFromProject,
  isDurationMode,
} from "../shot-duration";
import { journeyTakes } from "../takes";
import type {
  CanonicalTake,
  JourneyShot,
  JourneyShotTake,
  OutgoingStartDrop,
  Project,
  SegmentMotionPlan,
  ShootingFrameRef,
  StoryboardFrame,
} from "../types";
import { ensureDurableProjectId, persistedTakeVideoMediaId } from "./ids";
import {
  canonicalEntityPath,
  conversationEventsPath,
  isSafeProjectRelativePath,
  relativePosix,
  shootingFramesDir,
  takeAssetName,
  traversalEntityPath,
} from "./paths";
import {
  PROJECT_SCHEMA_VERSION,
  type MediaCopyRequest,
  type OpenedProjectWarnings,
  type ProjectManifest,
  type ProjectSettingsSnapshot,
  type SerializedProjectDocuments,
} from "./schema";
import { runtimeMediaPreviewUrl } from "../../../runtime-media-limits";

export type SerializeProjectInput = {
  project: Project;
  createdAt?: string;
  updatedAt?: string;
  movieExport?: MovieExportResult | null;
};

function extensionFromUrl(url: string | undefined, fallback: string): string {
  if (!url) {
    return fallback;
  }
  const match = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(url.split("/").pop() ?? "");
  if (!match) {
    return fallback;
  }
  const ext = match[1]!.toLowerCase();
  if (ext === "jpeg") {
    return "jpg";
  }
  return ext;
}

function extensionFromTake(take: CanonicalTake): string {
  return extensionFromUrl(take.imageUrl, take.origin === "user" ? "png" : "png");
}

function extensionFromVideo(take: JourneyShotTake): string {
  return extensionFromUrl(take.videoUrl ?? take.providerOutputUrl, "mp4");
}

function parseOutgoingStartDrop(raw: unknown): OutgoingStartDrop | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const drop = raw as Record<string, unknown>;
  if (
    typeof drop.incomingJourneyId !== "string" ||
    typeof drop.incomingTakeId !== "string" ||
    typeof drop.outgoingTakeId !== "string" ||
    typeof drop.dropped !== "boolean" ||
    typeof drop.ssim !== "number" ||
    typeof drop.mae !== "number"
  ) {
    return undefined;
  }
  return {
    incomingJourneyId: drop.incomingJourneyId,
    incomingTakeId: drop.incomingTakeId,
    outgoingTakeId: drop.outgoingTakeId,
    dropped: drop.dropped,
    ssim: drop.ssim,
    mae: drop.mae,
  };
}

function journeyStatus(project: Project): string {
  const shot = project.journeys.filter((item) => item.endDestinationId);
  if (shot.length > 0 && shot.every((item) => journeyTakes(item).some((take) => take.videoUrl))) {
    return "complete";
  }
  if (shot.some((item) => journeyTakes(item).length > 0)) {
    return "in_progress";
  }
  if (project.storyDurationLocked) {
    return "planned";
  }
  return "unplanned";
}

function settingsFromProject(project: Project): ProjectSettingsSnapshot {
  return {
    agency: project.agency,
    construction: project.construction,
    videoModel: project.videoModel,
    videoModelsByIntent: project.videoModelsByIntent,
    defaultTakeIntent: project.defaultTakeIntent,
    klingV3Mode: project.klingV3Mode,
    imageModel: project.imageModel,
    imageOutputFormat: project.imageOutputFormat,
    imageResolution: project.imageResolution,
    canonicalAspectRatio: project.canonicalAspectRatio,
    autoGenerateOpening: project.autoGenerateOpening,
    autoGenerateAllDestinations: project.autoGenerateAllDestinations,
    autoBlockShots: project.autoBlockShots,
    autoShoot: project.autoShoot,
    generateAudio: project.generateAudio,
    pullForwardReferenceEnabled: project.pullForwardReferenceEnabled !== false,
    cameraGrammar: cameraGrammarFromProject(project),
    durationMode: durationModeFromProject(project),
    fixedDurationSeconds: fixedDurationSecondsFromProject(project),
    storyDuration: project.storyDuration,
    storyDurationLocked: project.storyDurationLocked,
  };
}

function rememberCopy(
  copies: MediaCopyRequest[],
  seen: Map<string, string>,
  mediaId: string | undefined,
  relativePath: string,
  sourceUrl?: string,
) {
  if (!mediaId) {
    return;
  }
  const existing = seen.get(mediaId);
  if (existing) {
    return;
  }
  seen.set(mediaId, relativePath);
  copies.push({ mediaId, relativePath, sourceUrl });
}

function persistShootingFrame(
  copies: MediaCopyRequest[],
  seen: Map<string, string>,
  journeyId: string,
  role: "start" | "end",
  frame: ShootingFrameRef | undefined,
): ShootingFrameRef | undefined {
  if (!frame) {
    return undefined;
  }
  const existing = seen.get(frame.mediaId);
  if (existing) {
    return { mediaId: frame.mediaId, imageUrl: existing };
  }
  const ext = extensionFromUrl(frame.imageUrl, "png");
  const relativePath = relativePosix(shootingFramesDir(journeyId), `${role}-${frame.mediaId}.${ext}`);
  rememberCopy(copies, seen, frame.mediaId, relativePath, frame.imageUrl);
  return { mediaId: frame.mediaId, imageUrl: relativePath };
}

function persistMotionPlan(
  copies: MediaCopyRequest[],
  seen: Map<string, string>,
  journeyId: string,
  plan: SegmentMotionPlan,
): Record<string, unknown> {
  const start = persistShootingFrame(copies, seen, journeyId, "start", plan.startShootingFrame);
  const end = persistShootingFrame(copies, seen, journeyId, "end", plan.endShootingFrame);
  return {
    cinematographer: plan.cinematographer,
    startCanonicalMediaId: plan.startCanonicalMediaId,
    endCanonicalMediaId: plan.endCanonicalMediaId,
    startShootingFrame: start,
    endShootingFrame: end,
    startPlan: plan.startPlan,
    endPlan: plan.endPlan,
    segmentPromptAddition: plan.segmentPromptAddition,
    effectivePrompt: plan.effectivePrompt,
    pace: plan.pace,
    camotion: plan.camotion
      ? { depthSupplied: plan.camotion.depthSupplied, workDirRetained: false }
      : undefined,
  };
}

export function serializeProjectDocuments(input: SerializeProjectInput): SerializedProjectDocuments {
  const now = conversationTimestamp();
  const project = input.project;
  const id = ensureDurableProjectId(project.id);
  const copies: MediaCopyRequest[] = [];
  const seen = new Map<string, string>();
  const canonicals: Record<string, unknown> = {};
  const traversals: Record<string, unknown> = {};
  const shootingFrames: Record<string, unknown> = {};
  const canonicalIndex: ProjectManifest["canonicals"] = [];
  const traversalIndex: ProjectManifest["traversals"] = [];

  for (const frame of project.storyboard) {
    const takes = canonicalTakes(frame);
    const persistedTakes = takes.map((take) => {
      const asset = takeAssetName(take.number, extensionFromTake(take));
      const relativePath = relativePosix("canonicals", frame.id, asset);
      rememberCopy(copies, seen, take.mediaId, relativePath, take.imageUrl);
      return {
        id: take.id,
        number: take.number,
        mediaId: take.mediaId,
        asset,
        origin: take.origin,
        source: take.source,
        generatedFrom: take.generatedFrom,
        prompt: take.prompt,
        model: take.model,
        createdAt: take.createdAt,
        reason: take.reason,
        mediaInfo: take.mediaInfo,
        generation: take.generation,
      };
    });
    const selected = persistedTakes.find((take) => take.id === frame.selectedTakeId) ?? persistedTakes[persistedTakes.length - 1];
    canonicals[frame.id] = {
      id: frame.id,
      label: frame.label,
      intent: frame.intent,
      visualDescription: frame.visualDescription,
      imageOrigin: frame.imageOrigin,
      destinationId: frame.destinationId,
      mediaInfo: frame.mediaInfo,
      generatedFrom: frame.generatedFrom,
      selectedTakeId: selected?.id,
      takes: persistedTakes,
    };
    canonicalIndex.push({ id: frame.id, label: frame.label, file: canonicalEntityPath(frame.id) });
  }

  for (const journey of project.journeys) {
    const takes = journeyTakes(journey);
    const persistedTakes = takes.map((take) => {
      const asset = take.videoUrl || take.providerOutputUrl ? takeAssetName(take.number ?? 1, extensionFromVideo(take)) : undefined;
      const relativePath = asset ? relativePosix("traversals", journey.id, asset) : undefined;
      const videoMediaId = relativePath
        ? persistedTakeVideoMediaId(id, journey.id, take.number ?? 1)
        : undefined;
      if (relativePath && videoMediaId) {
        rememberCopy(copies, seen, videoMediaId, relativePath, take.videoUrl ?? take.providerOutputUrl);
      }
      const start = persistShootingFrame(copies, seen, journey.id, "start", take.startShootingFrame);
      const end = persistShootingFrame(copies, seen, journey.id, "end", take.endShootingFrame);
      return {
        id: take.id,
        number: take.number,
        asset,
        videoMediaId,
        startCanonicalMediaId: take.startCanonicalMediaId,
        endCanonicalMediaId: take.endCanonicalMediaId,
        startShootingFrame: start,
        endShootingFrame: end,
        startPlan: take.startPlan,
        endPlan: take.endPlan,
        segmentPromptAddition: take.segmentPromptAddition,
        effectivePrompt: take.effectivePrompt,
        pace: take.pace,
        provider: take.provider,
        model: take.model,
        modelVersion: take.modelVersion,
        generationIntent: take.generationIntent,
        durationSeconds: take.durationSeconds,
        seed: take.seed,
        providerOutputUrl: take.providerOutputUrl,
        videoInputs: take.videoInputs,
        generation: take.generation,
      };
    });
    const selected = persistedTakes.find((take) => take.id === journey.selectedTakeId) ?? persistedTakes[persistedTakes.length - 1];
    if (journey.motionPlan) {
      shootingFrames[journey.id] = persistMotionPlan(copies, seen, journey.id, journey.motionPlan);
    }
    traversals[journey.id] = {
      id: journey.id,
      startDestinationId: journey.startDestinationId,
      endDestinationId: journey.endDestinationId,
      durationSeconds: journey.durationSeconds,
      status: journey.status,
      shootabilityNote: journey.shootabilityNote,
      cinematographer: journey.cinematographer,
      cinematographerStartMediaId: journey.cinematographerStartMediaId,
      cinematographerEndMediaId: journey.cinematographerEndMediaId,
      filmmakerPace: journey.filmmakerPace,
      filmmakerDurationSeconds: journey.filmmakerDurationSeconds,
      motionPlan: shootingFrames[journey.id],
      motionPlanError: journey.motionPlanError,
      selectedTakeId: selected?.id,
      takes: persistedTakes,
      outgoingStartDrop: journey.outgoingStartDrop,
      shootError: journey.shootError,
    };
    traversalIndex.push({
      id: journey.id,
      from: journey.startDestinationId,
      to: journey.endDestinationId,
      file: traversalEntityPath(journey.id),
    });
  }

  const exports = input.movieExport
    ? [
        {
          filename: input.movieExport.filename,
          path: relativePosix("exports", input.movieExport.filename),
          complete: input.movieExport.complete,
          videoUrl: input.movieExport.videoUrl,
        },
      ]
    : undefined;

  const media: Record<string, string> = {};
  for (const copy of copies) {
    media[copy.mediaId] = copy.relativePath;
  }

  const name = project.title.trim() && project.title.trim() !== "UNTITLED" ? project.title.trim() : "Untitled";
  const manifest: ProjectManifest = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    journey: {
      mode: project.construction,
      agency: project.agency,
      initialPrompt: project.story,
      status: journeyStatus(project),
      storyDuration: project.storyDuration,
      storyDurationLocked: project.storyDurationLocked,
    },
    canonicals: canonicalIndex,
    traversals: traversalIndex,
    settings: settingsFromProject(project),
    media,
    ...(exports ? { exports } : {}),
  };

  return { manifest, canonicals, traversals, shootingFrames, mediaCopies: copies };
}

export function conversationEventsText(entries: readonly ConversationEntry[]): string {
  if (entries.length < 1) {
    return "";
  }
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

export function parseConversationEvents(text: string): ConversationEntry[] {
  const entries: ConversationEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as ConversationEntry;
      if (parsed && typeof parsed === "object" && typeof parsed.kind === "string") {
        entries.push(parsed);
      }
    } catch {
      // Skip a damaged line; the project must still open.
    }
  }
  return entries;
}

export function conversationFileName(): string {
  return conversationEventsPath();
}

function restoreShootingFrame(
  frame: ShootingFrameRef | undefined,
  missing: string[],
  present: (relativePath: string) => boolean,
): ShootingFrameRef | undefined {
  if (!frame) {
    return undefined;
  }
  const relative = isSafeProjectRelativePath(frame.imageUrl) ? frame.imageUrl : undefined;
  if (relative && !present(relative)) {
    missing.push(relative);
    return { mediaId: frame.mediaId, imageUrl: runtimeMediaPreviewUrl(frame.mediaId) };
  }
  return { mediaId: frame.mediaId, imageUrl: runtimeMediaPreviewUrl(frame.mediaId) };
}

function restoreMotionPlan(
  raw: Record<string, unknown> | undefined,
  missing: string[],
  present: (relativePath: string) => boolean,
): SegmentMotionPlan | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const start = restoreShootingFrame(raw.startShootingFrame as ShootingFrameRef | undefined, missing, present);
  const end = restoreShootingFrame(raw.endShootingFrame as ShootingFrameRef | undefined, missing, present);
  if (!start || !end) {
    return undefined;
  }
  return {
    cinematographer: raw.cinematographer as SegmentMotionPlan["cinematographer"],
    startCanonicalMediaId: String(raw.startCanonicalMediaId ?? ""),
    endCanonicalMediaId: String(raw.endCanonicalMediaId ?? ""),
    startShootingFrame: start,
    endShootingFrame: end,
    startPlan: raw.startPlan as SegmentMotionPlan["startPlan"],
    endPlan: raw.endPlan as SegmentMotionPlan["endPlan"],
    segmentPromptAddition: String(raw.segmentPromptAddition ?? ""),
    effectivePrompt: String(raw.effectivePrompt ?? ""),
    pace: raw.pace as SegmentMotionPlan["pace"],
  };
}

export type HydrateProjectInput = {
  manifest: ProjectManifest;
  canonicals: Record<string, unknown>;
  traversals: Record<string, unknown>;
  assetExists: (relativePath: string) => boolean;
};

export function hydrateProject(input: HydrateProjectInput): { project: Project; warnings: OpenedProjectWarnings } {
  const missingAssets: string[] = [];
  const present = (relativePath: string) => {
    if (!isSafeProjectRelativePath(relativePath)) {
      return false;
    }
    return input.assetExists(relativePath);
  };
  const settings = input.manifest.settings;
  const storyboard: StoryboardFrame[] = input.manifest.canonicals.map((index) => {
    const raw = (input.canonicals[index.id] ?? {}) as Record<string, unknown>;
    const takesRaw = Array.isArray(raw.takes) ? raw.takes : [];
    const takes: CanonicalTake[] = takesRaw.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const take = item as Record<string, unknown>;
      const mediaId = String(take.mediaId ?? "");
      const asset = typeof take.asset === "string" ? relativePosix("canonicals", index.id, take.asset) : undefined;
      if (asset && !present(asset)) {
        missingAssets.push(asset);
      }
      return [
        {
          id: String(take.id ?? ""),
          number: Number(take.number) || 1,
          mediaId,
          imageUrl: runtimeMediaPreviewUrl(mediaId),
          origin: take.origin === "user" ? "user" : "generated",
          source: take.source as CanonicalTake["source"],
          generatedFrom: typeof take.generatedFrom === "string" ? take.generatedFrom : undefined,
          prompt: typeof take.prompt === "string" ? take.prompt : undefined,
          model: typeof take.model === "string" ? take.model : undefined,
          createdAt: typeof take.createdAt === "string" ? take.createdAt : undefined,
          reason: typeof take.reason === "string" ? take.reason : undefined,
          mediaInfo: take.mediaInfo as CanonicalTake["mediaInfo"],
          generation: take.generation && typeof take.generation === "object" ? (take.generation as Record<string, unknown>) : undefined,
        },
      ];
    });
    const selectedId = typeof raw.selectedTakeId === "string" ? raw.selectedTakeId : takes[takes.length - 1]?.id;
    const selected = takes.find((take) => take.id === selectedId) ?? takes[takes.length - 1];
    const frame: StoryboardFrame = {
      id: index.id,
      label: typeof raw.label === "string" ? raw.label : index.label,
      imageOrigin: selected?.origin ?? (takes.length > 0 ? "generated" : "none"),
      intent: typeof raw.intent === "string" ? raw.intent : undefined,
      visualDescription: typeof raw.visualDescription === "string" ? raw.visualDescription : undefined,
      destinationId: typeof raw.destinationId === "string" ? raw.destinationId : undefined,
      generatedFrom: typeof raw.generatedFrom === "string" ? raw.generatedFrom : selected?.generatedFrom,
      takes,
      selectedTakeId: selected?.id,
    };
    if (selected) {
      frame.image = selected.imageUrl;
      frame.mediaId = selected.mediaId;
      if (selected.mediaInfo) {
        frame.mediaInfo = selected.mediaInfo;
      }
    }
    return frame;
  });

  const journeys: JourneyShot[] = input.manifest.traversals.map((index) => {
    const raw = (input.traversals[index.id] ?? {}) as Record<string, unknown>;
    const takesRaw = Array.isArray(raw.takes) ? raw.takes : [];
    const takes: JourneyShotTake[] = takesRaw.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const take = item as Record<string, unknown>;
      const asset = typeof take.asset === "string" ? relativePosix("traversals", index.id, take.asset) : undefined;
      if (asset && !present(asset)) {
        missingAssets.push(asset);
      }
      const start = restoreShootingFrame(take.startShootingFrame as ShootingFrameRef | undefined, missingAssets, present);
      const end = restoreShootingFrame(take.endShootingFrame as ShootingFrameRef | undefined, missingAssets, present);
      const takeNumber = Number(take.number) || 1;
      const videoMediaId = asset ? persistedTakeVideoMediaId(input.manifest.id, index.id, takeNumber) : undefined;
      return [
        {
          id: String(take.id ?? ""),
          number: takeNumber,
          videoUrl: videoMediaId ? runtimeMediaPreviewUrl(videoMediaId) : undefined,
          videoMediaId,
          startCanonicalMediaId: typeof take.startCanonicalMediaId === "string" ? take.startCanonicalMediaId : undefined,
          endCanonicalMediaId: typeof take.endCanonicalMediaId === "string" ? take.endCanonicalMediaId : undefined,
          startShootingFrame: start ?? { mediaId: "missing", imageUrl: "" },
          endShootingFrame: end ?? { mediaId: "missing", imageUrl: "" },
          startPlan: take.startPlan as JourneyShotTake["startPlan"],
          endPlan: take.endPlan as JourneyShotTake["endPlan"],
          segmentPromptAddition: String(take.segmentPromptAddition ?? ""),
          effectivePrompt: String(take.effectivePrompt ?? ""),
          pace: take.pace as JourneyShotTake["pace"],
          provider: String(take.provider ?? "replicate"),
          model: String(take.model ?? ""),
          modelVersion: typeof take.modelVersion === "string" || take.modelVersion === null ? (take.modelVersion as string | null) : null,
          generationIntent: take.generationIntent as JourneyShotTake["generationIntent"],
          durationSeconds: Number(take.durationSeconds) || 0,
          seed: typeof take.seed === "number" ? take.seed : undefined,
          providerOutputUrl: typeof take.providerOutputUrl === "string" ? take.providerOutputUrl : undefined,
          videoInputs: (take.videoInputs as JourneyShotTake["videoInputs"]) ?? { startShootingFrame: true, endShootingFrame: false },
          generation: take.generation && typeof take.generation === "object" ? (take.generation as Record<string, unknown>) : undefined,
        },
      ];
    });
    const selectedId = typeof raw.selectedTakeId === "string" ? raw.selectedTakeId : takes[takes.length - 1]?.id;
    const selected = takes.find((take) => take.id === selectedId) ?? takes[takes.length - 1];
    const motionPlan = restoreMotionPlan(raw.motionPlan as Record<string, unknown> | undefined, missingAssets, present);
    const journey: JourneyShot = {
      id: index.id,
      startDestinationId: typeof raw.startDestinationId === "string" ? raw.startDestinationId : index.from,
      endDestinationId:
        raw.endDestinationId === null || raw.endDestinationId === undefined
          ? index.to
          : String(raw.endDestinationId),
      durationSeconds: Number(raw.durationSeconds) || 0,
      status: (raw.status as JourneyShot["status"]) ?? "unplanned",
      cinematographer: raw.cinematographer as JourneyShot["cinematographer"],
      cinematographerStartMediaId: typeof raw.cinematographerStartMediaId === "string" ? raw.cinematographerStartMediaId : undefined,
      cinematographerEndMediaId: typeof raw.cinematographerEndMediaId === "string" ? raw.cinematographerEndMediaId : undefined,
      motionPlan,
      motionPlanError: typeof raw.motionPlanError === "string" ? raw.motionPlanError : undefined,
      filmmakerPace: isLocomotionPace(raw.filmmakerPace) ? raw.filmmakerPace : undefined,
      filmmakerDurationSeconds:
        typeof raw.filmmakerDurationSeconds === "number" && Number.isFinite(raw.filmmakerDurationSeconds)
          ? clampDurationSeconds(raw.filmmakerDurationSeconds)
          : undefined,
      takes,
      selectedTakeId: selected?.id,
      outgoingStartDrop: parseOutgoingStartDrop(raw.outgoingStartDrop),
      shootError: typeof raw.shootError === "string" ? raw.shootError : undefined,
      shootabilityNote: typeof raw.shootabilityNote === "string" ? raw.shootabilityNote : undefined,
    };
    if (selected?.videoUrl) {
      journey.videoUrl = selected.videoUrl;
      journey.take = selected;
    }
    return journey;
  });

  const blank = createNewProject();
  const project = projectWithSyncedProductionLegs({
    ...blank,
    id: input.manifest.id,
    title: input.manifest.name,
    story: input.manifest.journey.initialPrompt,
    agency: settings.agency ?? input.manifest.journey.agency,
    construction: settings.construction ?? input.manifest.journey.mode,
    storyDuration: settings.storyDuration ?? input.manifest.journey.storyDuration,
    storyDurationLocked: settings.storyDurationLocked ?? input.manifest.journey.storyDurationLocked,
    autoGenerateOpening: settings.autoGenerateOpening,
    autoGenerateAllDestinations: settings.autoGenerateAllDestinations,
    autoBlockShots: settings.autoBlockShots,
    autoShoot: settings.autoShoot,
    generateAudio: settings.generateAudio === true,
    pullForwardReferenceEnabled: settings.pullForwardReferenceEnabled !== false,
    cameraGrammar: cameraGrammarFromUnknown(settings.cameraGrammar),
    durationMode: isDurationMode(settings.durationMode) ? settings.durationMode : DEFAULT_DURATION_MODE,
    fixedDurationSeconds:
      typeof settings.fixedDurationSeconds === "number"
        ? clampDurationSeconds(settings.fixedDurationSeconds)
        : DEFAULT_FIXED_DURATION_SECONDS,
    videoModel: settings.videoModel,
    videoModelsByIntent: settings.videoModelsByIntent,
    defaultTakeIntent: settings.defaultTakeIntent,
    klingV3Mode: settings.klingV3Mode,
    imageModel: settings.imageModel,
    imageOutputFormat: settings.imageOutputFormat,
    imageResolution: settings.imageResolution,
    canonicalAspectRatio: settings.canonicalAspectRatio,
    storyboard: storyboard.length > 0 ? storyboard : blank.storyboard,
    journeys,
  });

  return { project, warnings: { missingAssets: [...new Set(missingAssets)] } };
}
