import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createNewProject } from "./new-project";
import { clampZoom } from "../timeline/geometry";
import { directorStoryRequestFromProject, requestDirectorPlan, requestDirectorStory } from "./director";
import {
  cinematographerRequestFromProject,
  canAssessJourney,
  cinematographerAssessmentIsCurrent,
  cinematographerPairMediaIds,
  hasCurrentMotionPlan,
  journeyMotionPlanInputKey,
  journeysReadyToBlock,
  motionPlanAutoKey,
  projectWithCinematographerAssessment,
  projectWithMotionPlanError,
  requestCinematographerAssessment,
} from "./cinematographer";
import {
  motionPlanStageRequestFromAssessment,
  projectWithMotionPlan,
  requestMotionPlan,
} from "./motion-plan";
import {
  canShootJourney,
  journeysReadyToAutoShoot,
  journeysReadyToTakeAll,
  projectWithDefaultTakeIntent,
  projectWithKlingV3Mode,
  projectWithJourneyClipDuration,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneysShooting,
  projectWithJourneyShotTake,
  projectWithVideoModel,
  projectWithVideoModelForIntent,
  requestShootJourney,
  shootRequestFromProject,
} from "./shoot";
import { projectWithLatestJourneyTakes, projectWithSelectedTake } from "./takes";
import { defaultTakeIntentFromProject, type GenerationIntent } from "./generation-intent";
import {
  canDownloadCurrentCut,
  currentCutClips,
  currentCutFingerprint,
} from "./current-cut";
import { journeyPlayheadStart, layoutShootTimeline, playheadStartForSelection } from "../timeline/shoot-layout";
import { readStoryboardMediaInfo, readStoryboardMediaInfoFromUrl } from "./media-preflight";
import { canDropAppendStoryboardDestination, hasAuthoritativeStartingFrame, projectWithReplacedFrameImage, uploadStartingFrame } from "./starting-frame";
import { canPlanMovie, projectWithAddedDestination, projectWithAutoBlockShots, projectWithAutoGenerateAllDestinations, projectWithAutoShoot, projectWithDirectorPlan, projectWithNudgedStoryDuration, projectWithRemovedDestination, projectWithStoryboardBeatPlan, projectWithStoryDuration, parseStoryDurationInput, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
import {
  requestConstructDestination,
  projectWithConstructedDestination,
  destinationConstructionRequestFromProject,
  destinationRepairRequestFromProject,
  openingFrameGenerationRequestFromProject,
  projectWithGeneratedOpeningFrame,
  projectWithRepairedCanonical,
  projectWithImageModel,
  projectWithImageOutputFormat,
  projectWithImageResolution,
  requestGenerateOpeningFrame,
  canGenerateOpeningFrame,
  canReshootDestinationFrame,
  nextConstructableDestinationId,
} from "./destination";
import {
  appendConversationEntry,
  agentConversationEntryFromEvent,
  conversationTimestamp,
  prepareDirectorPlan,
  resolveAgentEvaluationEntry,
  resolveBlockingEntry,
  resolveConstructionEntry,
  resolveDirectorEntry,
  resolveShootingEntry,
  type ConversationEntry,
} from "./conversation";
import { requestDownloadCurrentCut, requestExportMovie, type MovieExportResult } from "./export-movie";
import {
  idleJourneyAgentSnapshot,
  journeyAgentIsBusy,
  runJourneyAgent,
  type JourneyAgentSnapshot,
} from "./journey-agent";
import { storyboardFrameById, type Agency, type ImageModelId, type ImageOutputFormat, type ImageResolution, type JourneyShot, type KlingV3Mode, type Project, type Selection, type VideoModelId } from "./types";
import { commitActiveTextEdit } from "../ui/commit-text-edit";

function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

function withoutId(ids: string[], id: string): string[] {
  return ids.filter((item) => item !== id);
}

type DirectorStatus = "idle" | "planning" | "ready" | "error";

type ProjectContextValue = {
  project: Project;
  view: WorkspaceView;
  setView: (view: WorkspaceView) => void;
  selection: Selection;
  select: (selection: Selection) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  playheadTime: number;
  setPlayheadTime: (time: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  debugOn: boolean;
  setDebugOn: (on: boolean) => void;
  conversationRailOpen: boolean;
  setConversationRailOpen: (open: boolean) => void;
  projectRailOpen: boolean;
  setProjectRailOpen: (open: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  storyboardReelId: string | null;
  setStoryboardReelId: (frameId: string | null) => void;
  setAgency: (agency: Agency) => void;
  setVideoModel: (videoModel: VideoModelId) => void;
  setVideoModelForIntent: (intent: GenerationIntent, videoModel: VideoModelId) => void;
  setDefaultTakeIntent: (intent: GenerationIntent) => void;
  setKlingV3Mode: (mode: KlingV3Mode) => void;
  setImageModel: (imageModel: ImageModelId) => void;
  setImageOutputFormat: (imageOutputFormat: ImageOutputFormat) => void;
  setImageResolution: (imageResolution: ImageResolution) => void;
  syncJourneyClipDuration: (journeyId: string, durationSeconds: number) => void;
  composerDraft: string;
  setComposerDraft: (draft: string) => void;
  setStoryDurationInput: (raw: string) => void;
  nudgeStoryDuration: (delta: 1 | -1) => void;
  setAutoGenerateAllDestinations: (enabled: boolean) => void;
  setAutoBlockShots: (enabled: boolean) => void;
  setAutoShoot: (enabled: boolean) => void;
  conversation: ConversationEntry[];
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  planStartError: string | null;
  journeyAgent: JourneyAgentSnapshot;
  planWithDirector: () => Promise<void>;
  assessingJourneyIds: readonly string[];
  cinematographerError: string | null;
  retryMotionPlan: (journeyId: string) => Promise<void>;
  shootingJourneyIds: readonly string[];
  shootError: string | null;
  shootJourney: (journeyId: string, intent?: GenerationIntent) => Promise<void>;
  shootAllJourneys: (intent: GenerationIntent) => Promise<void>;
  selectTake: (journeyId: string, takeId: string) => void;
  cutPlaybackJourneyId: string | null;
  cutStartOffset: number;
  playCurrentCut: () => void;
  pauseCurrentCut: () => void;
  seekCutPrevious: () => void;
  seekCutNext: () => void;
  advanceCutClip: () => void;
  downloadCurrentCut: () => Promise<void>;
  downloadingCut: boolean;
  startingFrameError: string | null;
  replacingStart: boolean;
  replaceDestinationImage: (frameId: string, file: File, options?: { clearPlan?: boolean }) => Promise<void>;
  appendDestinationWithImage: (file: File) => Promise<void>;
  addDestination: () => void;
  openStoryboardInPlan: (frameId: string) => void;
  removeDestination: (frameId: string) => void;
  constructingBeatId: string | null;
  constructDestination: (beatId: string) => Promise<void>;
  generateOpeningFrame: () => Promise<void>;
  setDestinationPlan: (frameId: string, next: { intent?: string; visualDescription?: string }) => void;
  reshootDestination: (frameId: string) => Promise<void>;
  movieExport: MovieExportResult | null;
  exportingMovie: boolean;
  exportMovieError: string | null;
  exportMovie: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

/** Survives React Strict Mode remount so one canonical pair is not planned twice. */
const inFlightMotionPlans = new Map<string, Promise<Project>>();

export function ProjectProvider({
  children,
  initialProject,
  initialConversation,
  initialComposerDraft,
  initialView = "plan",
  initialSelection,
  initialDebug = true, // temporary: retain Camotion work dirs by default
  initialConversationRailOpen = true,
  initialProjectRailOpen = true,
  initialInspectorOpen = true,
  initialStoryboardReelId = null,
  initialAssessingJourneyIds = [],
  initialShootingJourneyIds = [],
  initialConstructingBeatId = null,
  initialDirectorStatus = "idle",
  initialCutPlaybackJourneyId = null,
  initialPlaying = false,
}: {
  children: ReactNode;
  initialProject?: Project;
  initialConversation?: ConversationEntry[];
  initialComposerDraft?: string;
  initialView?: WorkspaceView;
  initialSelection?: Selection;
  initialDebug?: boolean;
  initialConversationRailOpen?: boolean;
  initialProjectRailOpen?: boolean;
  initialInspectorOpen?: boolean;
  initialStoryboardReelId?: string | null;
  initialAssessingJourneyIds?: readonly string[];
  initialShootingJourneyIds?: readonly string[];
  initialConstructingBeatId?: string | null;
  initialDirectorStatus?: DirectorStatus;
  initialCutPlaybackJourneyId?: string | null;
  initialPlaying?: boolean;
}) {
  const [project, setProject] = useState(() => initialProject ?? createNewProject());
  const projectRef = useRef(project);
  projectRef.current = project;
  const [view, setViewState] = useState<WorkspaceView>(initialView);
  const [selection, setSelection] = useState<Selection>(
    () => initialSelection ?? { kind: "storyboard", frameId: "A" },
  );
  const [zoom, setZoomState] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(initialPlaying);
  const [cutPlaybackJourneyId, setCutPlaybackJourneyId] = useState<string | null>(initialCutPlaybackJourneyId);
  const [cutStartOffset, setCutStartOffset] = useState(0);
  const [downloadingCut, setDownloadingCut] = useState(false);
  const assembledCutRef = useRef<{ fingerprint: string; result: MovieExportResult } | null>(null);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>(initialDirectorStatus);
  const [planStartError, setPlanStartError] = useState<string | null>(null);
  const [journeyAgent, setJourneyAgent] = useState<JourneyAgentSnapshot>(idleJourneyAgentSnapshot);
  const [assessingJourneyIds, setAssessingJourneyIds] = useState<string[]>(() => [
    ...initialAssessingJourneyIds,
  ]);
  const [cinematographerError, setCinematographerError] = useState<string | null>(null);
  const [shootingJourneyIds, setShootingJourneyIds] = useState<string[]>(() => [
    ...initialShootingJourneyIds,
  ]);
  const [shootError, setShootError] = useState<string | null>(null);
  const [startingFrameError, setStartingFrameError] = useState<string | null>(null);
  const [replacingStart, setReplacingStart] = useState(false);
  const [constructingBeatId, setConstructingBeatId] = useState<string | null>(
    () => initialConstructingBeatId,
  );
  const [movieExport, setMovieExport] = useState<MovieExportResult | null>(null);
  const [exportingMovie, setExportingMovie] = useState(false);
  const [exportMovieError, setExportMovieError] = useState<string | null>(null);
  const [debugOn, setDebugOn] = useState(initialDebug);
  const debugOnRef = useRef(debugOn);
  debugOnRef.current = debugOn;
  const [conversationRailOpen, setConversationRailOpen] = useState(initialConversationRailOpen);
  const [projectRailOpen, setProjectRailOpen] = useState(initialProjectRailOpen);
  const [inspectorOpen, setInspectorOpen] = useState(initialInspectorOpen);
  const [storyboardReelId, setStoryboardReelId] = useState<string | null>(initialStoryboardReelId);
  const [composerDraft, setComposerDraftState] = useState(
    () => initialComposerDraft ?? initialProject?.story ?? "",
  );
  const [conversation, setConversation] = useState<ConversationEntry[]>(
    () => initialConversation ?? [],
  );
  const conversationId = useRef(0);
  const agentConversationCursor = useRef(0);

  const nextConversationId = useCallback((prefix: string) => {
    conversationId.current += 1;
    return `${prefix}-${conversationId.current}`;
  }, []);

  const select = useCallback((next: Selection) => {
    commitActiveTextEdit();
    setSelection(next);
    setPlaying(false);
    setCutPlaybackJourneyId(null);
    setCutStartOffset(0);
    const start = playheadStartForSelection(projectRef.current, next);
    if (start != null) {
      setPlayheadTime(start);
    }
  }, []);

  const setView = useCallback((next: WorkspaceView) => {
    if (next === "shoot" && !hasAuthoritativeStartingFrame(project)) {
      return;
    }
    commitActiveTextEdit();
    setStoryboardReelId(null);
    setViewState(next);
    setSelection((current) => selectionForWorkspaceView(next, current, project));
    setPlaying(false);
    setCutPlaybackJourneyId(null);
    setCutStartOffset(0);
  }, [project]);

  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
  }, []);

  const setAgency = useCallback((agency: Agency) => {
    setProject((current) => ({ ...current, agency }));
  }, []);

  const setVideoModel = useCallback((videoModel: VideoModelId) => {
    setProject((current) => projectWithVideoModel(current, videoModel));
  }, []);

  const setVideoModelForIntent = useCallback((intent: GenerationIntent, videoModel: VideoModelId) => {
    setProject((current) => projectWithVideoModelForIntent(current, intent, videoModel));
  }, []);

  const setDefaultTakeIntent = useCallback((intent: GenerationIntent) => {
    setProject((current) => projectWithDefaultTakeIntent(current, intent));
  }, []);

  const setKlingV3Mode = useCallback((mode: KlingV3Mode) => {
    setProject((current) => projectWithKlingV3Mode(current, mode));
  }, []);

  const setImageModel = useCallback((imageModel: ImageModelId) => {
    setProject((current) => projectWithImageModel(current, imageModel));
  }, []);

  const setImageOutputFormat = useCallback((imageOutputFormat: ImageOutputFormat) => {
    setProject((current) => projectWithImageOutputFormat(current, imageOutputFormat));
  }, []);

  const setImageResolution = useCallback((imageResolution: ImageResolution) => {
    setProject((current) => projectWithImageResolution(current, imageResolution));
  }, []);

  const syncJourneyClipDuration = useCallback((journeyId: string, durationSeconds: number) => {
    setProject((current) => projectWithJourneyClipDuration(current, journeyId, durationSeconds));
  }, []);

  const setComposerDraft = useCallback((draft: string) => {
    setComposerDraftState(draft);
    setProject((current) => (current.story === draft ? current : { ...current, story: draft }));
  }, []);

  const setStoryDurationInput = useCallback((raw: string) => {
    const parsed = parseStoryDurationInput(raw);
    if (!parsed.ok) {
      return;
    }
    setProject((current) => projectWithStoryDuration(current, parsed.duration));
  }, []);

  const nudgeStoryDuration = useCallback((delta: 1 | -1) => {
    setProject((current) => projectWithNudgedStoryDuration(current, delta));
  }, []);

  const applyProject = useCallback((next: Project): Project => {
    const merged = projectWithLatestJourneyTakes(next, projectRef.current);
    projectRef.current = merged;
    setProject(merged);
    return merged;
  }, []);

  const setAutoGenerateAllDestinations = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoGenerateAllDestinations(current, enabled));
  }, []);

  const setAutoBlockShots = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoBlockShots(current, enabled));
  }, []);

  const setAutoShoot = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoShoot(current, enabled));
  }, []);

  const replaceDestinationImage = useCallback(async (
    frameId: string,
    file: File,
    options?: { clearPlan?: boolean },
  ) => {
    setStartingFrameError(null);
    setReplacingStart(true);
    try {
      const uploaded = await uploadStartingFrame(file);
      const mediaInfo = await readStoryboardMediaInfo(file);
      setProject((current) =>
        projectWithReplacedFrameImage(
          current,
          frameId,
          mediaInfo ? { ...uploaded, mediaInfo } : uploaded,
          options,
        ),
      );
      setSelection({ kind: "storyboard", frameId });
    } catch (error) {
      setStartingFrameError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setReplacingStart(false);
    }
  }, []);

  const appendDestinationWithImage = useCallback(async (file: File) => {
    const current = projectRef.current;
    if (
      directorStatus === "planning" ||
      constructingBeatId ||
      journeyAgentIsBusy(journeyAgent) ||
      !canDropAppendStoryboardDestination(current)
    ) {
      return;
    }
    const added = projectWithAddedDestination(current);
    const frame = added.storyboard[added.storyboard.length - 1];
    if (!frame || current.storyboard.some((item) => item.id === frame.id)) {
      return;
    }
    applyProject(added);
    await replaceDestinationImage(frame.id, file);
  }, [applyProject, constructingBeatId, directorStatus, journeyAgent, replaceDestinationImage]);

  const addDestination = useCallback(() => {
    setProject((current) => {
      if (directorStatus === "planning" || constructingBeatId || journeyAgentIsBusy(journeyAgent)) {
        return current;
      }
      return projectWithAddedDestination(current);
    });
  }, [constructingBeatId, directorStatus, journeyAgent]);

  const openStoryboardInPlan = useCallback((frameId: string) => {
    setProject((current) => {
      if (storyboardFrameById(current.storyboard, frameId)) {
        return current;
      }
      let next = current;
      while (!storyboardFrameById(next.storyboard, frameId)) {
        const grown = projectWithAddedDestination(next);
        if (grown === next) {
          break;
        }
        next = grown;
      }
      return next;
    });
    setSelection({ kind: "storyboard", frameId });
    setViewState("plan");
    setPlaying(false);
  }, []);

  const removeDestination = useCallback((frameId: string) => {
    setProject((current) => projectWithRemovedDestination(current, frameId));
    setSelection((current) => {
      if (current.kind === "storyboard" && current.frameId === frameId) {
        return { kind: "storyboard", frameId: "A" };
      }
      if (current.kind === "destination" && current.destinationId === frameId) {
        return { kind: "destination", destinationId: "A", occurrenceIndex: 0 };
      }
      if (
        current.kind === "journey" &&
        (current.journeyId.startsWith(`${frameId}-`) || current.journeyId.endsWith(`-${frameId}`))
      ) {
        return { kind: "destination", destinationId: "A", occurrenceIndex: 0 };
      }
      return current;
    });
  }, []);

  const constructDestinationOn = useCallback(
    async (current: Project, beatId: string): Promise<Project> => {
      const entryId = nextConversationId("construction");
      setConstructingBeatId(beatId);
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "construction",
          beatId,
          status: "constructing",
        }),
      );
      try {
        const request = destinationConstructionRequestFromProject(current, beatId);
        const result = await requestConstructDestination(request);
        const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
        const next = applyProject(
          projectWithConstructedDestination(projectRef.current, {
            beatId: request.beatId,
            mediaId: result.mediaId,
            imageUrl: result.imageUrl,
            ...(mediaInfo ? { mediaInfo } : {}),
          }),
        );
        setConversation((entries) =>
          resolveConstructionEntry(entries, entryId, {
            status: "constructed",
            imageUrl: result.imageUrl,
          }),
        );
        return next;
      } catch (error) {
        setConversation((entries) =>
          resolveConstructionEntry(entries, entryId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Destination construction failed.",
          }),
        );
        throw error;
      } finally {
        setConstructingBeatId(null);
      }
    },
    [applyProject, nextConversationId],
  );

  const constructDestination = useCallback(
    async (beatId: string) => {
      try {
        await constructDestinationOn(projectRef.current, beatId);
      } catch {
        // Conversation already records the failure.
      }
    },
    [constructDestinationOn],
  );

  const repairCanonicalOn = useCallback(
    async (
      current: Project,
      beatId: string,
      input: {
        role: "start" | "end";
        instruction: string;
        referenceMediaId?: string;
      },
    ): Promise<Project> => {
      const request = destinationRepairRequestFromProject(current, beatId, input);
      const result = await requestConstructDestination(request);
      const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
      const next = applyProject(
        projectWithRepairedCanonical(projectRef.current, {
          beatId: request.beatId,
          mediaId: result.mediaId,
          imageUrl: result.imageUrl,
          ...(mediaInfo ? { mediaInfo } : {}),
        }),
      );
      return next;
    },
    [applyProject],
  );

  const generateOpeningOn = useCallback(
    async (current: Project): Promise<Project> => {
      const entryId = nextConversationId("construction");
      setConstructingBeatId("A");
      setStartingFrameError(null);
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "construction",
          beatId: "A",
          status: "constructing",
        }),
      );
      try {
        const request = openingFrameGenerationRequestFromProject(current);
        const result = await requestGenerateOpeningFrame(request);
        const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
        const next = applyProject(
          projectWithGeneratedOpeningFrame(current, {
            mediaId: result.mediaId,
            imageUrl: result.imageUrl,
            ...(mediaInfo ? { mediaInfo } : {}),
          }),
        );
        setConversation((entries) =>
          resolveConstructionEntry(entries, entryId, {
            status: "constructed",
            imageUrl: result.imageUrl,
          }),
        );
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Opening frame generation failed.";
        setStartingFrameError(message);
        setConversation((entries) =>
          resolveConstructionEntry(entries, entryId, {
            status: "failed",
            error: message,
          }),
        );
        throw error;
      } finally {
        setConstructingBeatId(null);
      }
    },
    [applyProject, nextConversationId],
  );

  const generateOpeningFrame = useCallback(async () => {
    try {
      await generateOpeningOn(projectRef.current);
    } catch {
      // Conversation already records the failure.
    }
  }, [generateOpeningOn]);

  const setDestinationPlan = useCallback(
    (frameId: string, next: { intent?: string; visualDescription?: string }) => {
      applyProject(projectWithStoryboardBeatPlan(projectRef.current, frameId, next));
    },
    [applyProject],
  );

  const reshootDestination = useCallback(
    async (frameId: string) => {
      const current = projectRef.current;
      const frame = current.storyboard.find((item) => item.id === frameId);
      if (!frame || !canReshootDestinationFrame(current, frame)) {
        return;
      }
      try {
        if (frameId === "A") {
          await generateOpeningOn(current);
          return;
        }
        await constructDestinationOn(current, frameId);
      } catch {
        // Conversation already records the failure.
      }
    },
    [constructDestinationOn, generateOpeningOn],
  );

  const assessCinematographerOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(current, journey) || cinematographerAssessmentIsCurrent(current, journey)) {
        return current;
      }
      setAssessingJourneyIds((ids) => withId(ids, journeyId));
      try {
        const request = cinematographerRequestFromProject(current, journeyId);
        const result = await requestCinematographerAssessment(request);
        const latest = projectRef.current;
        const latestJourney = latest.journeys.find((item) => item.id === journeyId);
        const latestPair = latestJourney ? cinematographerPairMediaIds(latest, latestJourney) : undefined;
        if (
          !latestPair ||
          latestPair.startMediaId !== request.startMediaId ||
          latestPair.endMediaId !== request.endMediaId
        ) {
          return latest;
        }
        const next = projectWithCinematographerAssessment(latest, journeyId, result.assessment, {
          startCanonicalMediaId: request.startMediaId,
          endCanonicalMediaId: request.endMediaId,
        });
        applyProject(next);
        return next;
      } finally {
        setAssessingJourneyIds((ids) => withoutId(ids, journeyId));
      }
    },
    [applyProject],
  );

  const assessJourneyOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(current, journey) || hasCurrentMotionPlan(current, journey)) {
        return current;
      }
      const inputKey = journeyMotionPlanInputKey(current, journey);
      if (!inputKey) {
        return current;
      }
      const pending = inFlightMotionPlans.get(inputKey);
      if (pending) {
        return pending;
      }
      const work = (async (): Promise<Project> => {
      const entryId = nextConversationId("blocking");
      setCinematographerError(null);
      if (journey.motionPlanError) {
        applyProject(projectWithMotionPlanError(current, journeyId, undefined));
      }
      setAssessingJourneyIds((ids) => withId(ids, journeyId));
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "blocking",
          journeyId,
          status: "blocking",
        }),
      );
      try {
        const request = cinematographerRequestFromProject(current, journeyId);
        const reuseAssessment =
          cinematographerAssessmentIsCurrent(current, journey) && journey.cinematographer
            ? journey.cinematographer
            : undefined;
        const assessment =
          reuseAssessment ?? (await requestCinematographerAssessment(request)).assessment;
        const staged = await requestMotionPlan(
          motionPlanStageRequestFromAssessment(
            journeyId,
            request.startMediaId,
            request.endMediaId,
            assessment,
            debugOnRef.current,
          ),
        );
        const latest = projectRef.current;
        const latestJourney = latest.journeys.find((item) => item.id === journeyId);
        if (!latestJourney || journeyMotionPlanInputKey(latest, latestJourney) !== inputKey) {
          setConversation((entries) =>
            resolveBlockingEntry(entries, entryId, {
              status: "failed",
              error: "Canonical pair changed",
            }),
          );
          return latest;
        }
        if (hasCurrentMotionPlan(latest, latestJourney)) {
          setConversation((entries) =>
            resolveBlockingEntry(entries, entryId, {
              status: "blocked",
              assessment,
            }),
          );
          return latest;
        }
        const next = projectWithMotionPlan(latest, journeyId, {
          cinematographer: assessment,
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
        applyProject(next);
        setConversation((entries) =>
          resolveBlockingEntry(entries, entryId, {
            status: "blocked",
            assessment,
          }),
        );
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cinematographer assessment failed";
        setCinematographerError(message);
        applyProject(projectWithMotionPlanError(projectRef.current, journeyId, message));
        setConversation((entries) =>
          resolveBlockingEntry(entries, entryId, {
            status: "failed",
            error: message,
          }),
        );
        throw error;
      } finally {
        inFlightMotionPlans.delete(inputKey);
        setAssessingJourneyIds((ids) => withoutId(ids, journeyId));
      }
      })();
      inFlightMotionPlans.set(inputKey, work);
      return work;
    },
    [applyProject, nextConversationId],
  );

  const completeJourneyShoot = useCallback(
    async (journeyId: string, resolvedIntent: GenerationIntent, entryId: string): Promise<Project> => {
      try {
        const request = shootRequestFromProject(projectRef.current, journeyId, resolvedIntent);
        const result = await requestShootJourney({ ...request, debug: debugOnRef.current });
        const stamped = {
          ...result,
          take: { ...result.take, generationIntent: result.take.generationIntent ?? resolvedIntent },
        };
        const next = projectWithJourneyShotTake(projectRef.current, journeyId, stamped);
        applyProject(next);
        setConversation((entries) =>
          resolveShootingEntry(entries, entryId, {
            status: "shot",
            take: stamped.take,
            videoUrl: stamped.videoUrl,
          }),
        );
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Shoot failed";
        setShootError(message);
        const failed = projectWithJourneyShotFailed(projectRef.current, journeyId, message);
        applyProject(failed);
        setConversation((entries) =>
          resolveShootingEntry(entries, entryId, {
            status: "failed",
            error: message,
          }),
        );
        throw error;
      } finally {
        setShootingJourneyIds((ids) => withoutId(ids, journeyId));
      }
    },
    [applyProject],
  );

  const shootJourneyOn = useCallback(
    async (current: Project, journeyId: string, intent?: GenerationIntent): Promise<Project> => {
      const resolvedIntent = intent ?? defaultTakeIntentFromProject(current);
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canShootJourney(current, journey)) {
        throw new Error("Stage this journey before generating");
      }
      const entryId = nextConversationId("shooting");
      setShootError(null);
      setShootingJourneyIds((ids) => withId(ids, journeyId));
      applyProject(projectWithJourneyShooting(projectRef.current, journeyId));
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "shooting",
          journeyId,
          status: "shooting",
        }),
      );
      return completeJourneyShoot(journeyId, resolvedIntent, entryId);
    },
    [applyProject, completeJourneyShoot, nextConversationId],
  );

  const assessJourney = useCallback(
    async (journeyId: string) => {
      try {
        await assessJourneyOn(projectRef.current, journeyId);
      } catch {
        // Conversation already records the failure.
      }
    },
    [assessJourneyOn],
  );

  const retryMotionPlan = useCallback(
    async (journeyId: string) => {
      const current = projectRef.current;
      const journey = current.journeys.find((item) => item.id === journeyId);
      const inputKey = journey ? journeyMotionPlanInputKey(current, journey) : null;
      if (inputKey) {
        inFlightMotionPlans.delete(inputKey);
      }
      await assessJourney(journeyId);
    },
    [assessJourney],
  );

  const autoMotionKey = useMemo(() => motionPlanAutoKey(project), [project]);
  useEffect(() => {
    if (journeyAgentIsBusy(journeyAgent)) {
      return;
    }
    const current = projectRef.current;
    for (const journey of journeysReadyToBlock(current)) {
      void assessJourney(journey.id);
    }
  }, [assessJourney, autoMotionKey, journeyAgent]);

  const shootJourney = useCallback(
    async (journeyId: string, intent?: GenerationIntent) => {
      try {
        await shootJourneyOn(projectRef.current, journeyId, intent);
      } catch {
        // Conversation already records the failure.
      }
    },
    [shootJourneyOn],
  );

  const shootAllJourneys = useCallback(
    async (intent: GenerationIntent) => {
      const current = projectRef.current;
      const launches = journeysReadyToTakeAll(current).map((journey) => ({
        journeyId: journey.id,
        entryId: nextConversationId("shooting"),
      }));
      if (launches.length === 0) {
        return;
      }
      setShootError(null);
      applyProject(projectWithJourneysShooting(current, launches.map((launch) => launch.journeyId)));
      setShootingJourneyIds((ids) =>
        launches.reduce((next, launch) => withId(next, launch.journeyId), ids),
      );
      setConversation((entries) =>
        launches.reduce(
          (next, launch) =>
            appendConversationEntry(next, {
              id: launch.entryId,
              createdAt: conversationTimestamp(),
              kind: "shooting",
              journeyId: launch.journeyId,
              status: "shooting",
            }),
          entries,
        ),
      );
      await Promise.all(
        launches.map(async ({ journeyId, entryId }) => {
          try {
            await completeJourneyShoot(journeyId, intent, entryId);
          } catch {
            // One failure must not drop the rest of the overlapping batch.
          }
        }),
      );
    },
    [applyProject, completeJourneyShoot, nextConversationId],
  );

  const selectTake = useCallback(
    (journeyId: string, takeId: string) => {
      applyProject(projectWithSelectedTake(projectRef.current, journeyId, takeId));
      const start = journeyPlayheadStart(projectRef.current, journeyId);
      if (start != null) {
        setPlayheadTime(start);
        setCutStartOffset(0);
      }
    },
    [applyProject],
  );

  const laidClipsForCut = useCallback((current: Project) => {
    const layout = layoutShootTimeline(current, 1);
    return currentCutClips(current).flatMap((clip) => {
      const laid = layout.journeys.find((item) => item.journeyId === clip.journeyId);
      return laid ? [{ clip, laid }] : [];
    });
  }, []);

  const playCurrentCut = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    if (clips.length === 0) {
      return;
    }
    const atPlayhead =
      clips.find(({ laid }) => playheadTime < laid.endTime - 0.05) ?? clips[clips.length - 1]!;
    const offset = Math.max(0, Math.min(playheadTime - atPlayhead.laid.startTime, atPlayhead.clip.durationSeconds));
    setCutPlaybackJourneyId(atPlayhead.clip.journeyId);
    setCutStartOffset(Number.isFinite(offset) ? offset : 0);
    setPlaying(true);
  }, [laidClipsForCut, playheadTime]);

  const pauseCurrentCut = useCallback(() => {
    setPlaying(false);
  }, []);

  const seekCutPrevious = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    if (clips.length === 0) {
      return;
    }
    const index = clips.findIndex(({ clip }) => clip.journeyId === cutPlaybackJourneyId);
    const currentIndex = index < 0 ? 0 : index;
    const atStart = playheadTime - (clips[currentIndex]?.laid.startTime ?? 0) < 1;
    const previous =
      currentIndex > 0 && atStart ? clips[currentIndex - 1]! : clips[currentIndex] ?? clips[0]!;
    setCutPlaybackJourneyId(previous.clip.journeyId);
    setCutStartOffset(0);
    setPlayheadTime(previous.laid.startTime);
    if (playing) {
      setPlaying(true);
    }
  }, [cutPlaybackJourneyId, laidClipsForCut, playheadTime, playing]);

  const seekCutNext = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    if (clips.length === 0) {
      return;
    }
    const index = clips.findIndex(({ clip }) => clip.journeyId === cutPlaybackJourneyId);
    const next = index >= 0 && index < clips.length - 1 ? clips[index + 1]! : clips[clips.length - 1]!;
    setCutPlaybackJourneyId(next.clip.journeyId);
    setCutStartOffset(0);
    setPlayheadTime(next.laid.startTime);
    if (index >= clips.length - 1) {
      setPlaying(false);
    }
  }, [cutPlaybackJourneyId, laidClipsForCut]);

  const advanceCutClip = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    const index = clips.findIndex(({ clip }) => clip.journeyId === cutPlaybackJourneyId);
    if (index < 0 || index >= clips.length - 1) {
      setPlaying(false);
      return;
    }
    const next = clips[index + 1]!;
    setCutPlaybackJourneyId(next.clip.journeyId);
    setCutStartOffset(0);
    setPlayheadTime(next.laid.startTime);
    setPlaying(true);
  }, [cutPlaybackJourneyId, laidClipsForCut]);

  const downloadCurrentCut = useCallback(async () => {
    const current = projectRef.current;
    if (!canDownloadCurrentCut(current)) {
      return;
    }
    const fingerprint = currentCutFingerprint(current);
    const cached = assembledCutRef.current;
    const result =
      cached && cached.fingerprint === fingerprint
        ? cached.result
        : await (async () => {
            setDownloadingCut(true);
            setExportMovieError(null);
            try {
              const assembled = await requestDownloadCurrentCut(current);
              assembledCutRef.current = { fingerprint, result: assembled };
              setMovieExport(assembled);
              return assembled;
            } catch (error) {
              setExportMovieError(error instanceof Error ? error.message : "Download failed");
              throw error;
            } finally {
              setDownloadingCut(false);
            }
          })();
    const link = document.createElement("a");
    link.href = result.videoUrl;
    link.download = result.filename;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  }, []);

  const writeStoryFromOpeningOn = useCallback(
    async (current: Project): Promise<Project> => {
      if (current.story.trim()) {
        return current;
      }
      if (!hasAuthoritativeStartingFrame(current)) {
        throw new Error("Enter a journey story or add starting frame A.");
      }
      const storyId = nextConversationId("director");
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: storyId,
          createdAt: conversationTimestamp(),
          kind: "director",
          status: "planning",
          phase: "story",
        }),
      );
      const storyResult = await requestDirectorStory(directorStoryRequestFromProject(current));
      const story = storyResult.story.trim();
      if (!story) {
        throw new Error("Director returned no journey story");
      }
      const next = applyProject({ ...current, story });
      setComposerDraftState(story);
      setConversation((entries) =>
        resolveDirectorEntry(entries, storyId, {
          status: "complete",
          phase: "story",
          evidence: storyResult.evidence,
          summary: story,
        }),
      );
      return next;
    },
    [applyProject, nextConversationId],
  );

  const planDirectorOn = useCallback(
    async (current: Project): Promise<Project> => {
      const prepared = prepareDirectorPlan(current);
      if (!prepared.ok) {
        throw new Error(
          prepared.reason === "invalid"
            ? (prepared.message ?? "Director planning failed")
            : "Director requires a filmmaker story",
        );
      }
      const directorId = nextConversationId("director");
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: directorId,
          createdAt: conversationTimestamp(),
          kind: "director",
          status: "planning",
          phase: "plan",
        }),
      );
      const result = await requestDirectorPlan(prepared.request);
      const summary = result.plan.summary?.trim();
      if (!summary) {
        throw new Error("Director returned no filmmaker-facing summary");
      }
      const next = applyProject(projectWithDirectorPlan(current, result.plan));
      setConversation((entries) =>
        resolveDirectorEntry(entries, directorId, {
          status: "complete",
          evidence: result.evidence,
          summary,
        }),
      );
      setDirectorStatus("ready");
      return next;
    },
    [applyProject, nextConversationId],
  );

  const runAutonomousJourney = useCallback(async () => {
    agentConversationCursor.current = 0;
    const result = await runJourneyAgent(
      projectRef.current,
      {
        generateOpening: generateOpeningOn,
        writeStoryFromOpening: writeStoryFromOpeningOn,
        planJourney: planDirectorOn,
        constructDestination: constructDestinationOn,
        assessCinematographer: assessCinematographerOn,
        repairCanonical: repairCanonicalOn,
        planMotion: assessJourneyOn,
        createTake: shootJourneyOn,
        assembleMovie: async (current) => {
          setExportingMovie(true);
          setExportMovieError(null);
          try {
            const exported = await requestExportMovie(current);
            setMovieExport(exported);
            setConversation((entries) =>
              appendConversationEntry(entries, {
                id: nextConversationId("assembly"),
                createdAt: conversationTimestamp(),
                kind: "assembly",
                status: "complete",
                videoUrl: exported.videoUrl,
                filename: exported.filename,
                complete: exported.complete,
              }),
            );
            return { project: current, export: exported };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Movie export failed";
            setExportMovieError(message);
            throw error;
          } finally {
            setExportingMovie(false);
          }
        },
      },
      (snapshot) => {
        setJourneyAgent(snapshot);
        const fresh = snapshot.events.slice(agentConversationCursor.current);
        agentConversationCursor.current = snapshot.events.length;
        if (fresh.length === 0) {
          return;
        }
        setConversation((entries) =>
          fresh.reduce((current, event) => {
            if (
              event.kind === "cinematographer-evaluated" ||
              event.kind === "cinematographer-reevaluated"
            ) {
              const journeyId = event.journeyId ?? event.journeyIds?.[0];
              if (!journeyId) {
                return current;
              }
              return resolveAgentEvaluationEntry(current, journeyId, {
                status: event.kind === "cinematographer-reevaluated" ? "reevaluated" : "evaluated",
                ...(event.setConsistency != null ? { setConsistency: event.setConsistency } : {}),
                ...(event.traversalConfidence != null
                  ? { traversalConfidence: event.traversalConfidence }
                  : {}),
              });
            }
            if (
              event.kind !== "canonical-repair" &&
              event.kind !== "canonical-repair-complete" &&
              event.kind !== "cinematographer-evaluation" &&
              event.kind !== "cinematographer-reevaluation"
            ) {
              return current;
            }
            const entry = agentConversationEntryFromEvent(
              nextConversationId("agent"),
              conversationTimestamp(),
              event,
            );
            return entry ? appendConversationEntry(current, entry) : current;
          }, entries),
        );
      },
    );
    applyProject(projectWithLatestJourneyTakes(result.project, projectRef.current));
    if (result.snapshot.phase !== "FAILED") {
      setJourneyAgent(result.snapshot);
    }
  }, [
    assessCinematographerOn,
    assessJourneyOn,
    constructDestinationOn,
    generateOpeningOn,
    nextConversationId,
    planDirectorOn,
    repairCanonicalOn,
    shootJourneyOn,
    writeStoryFromOpeningOn,
  ]);

  const planWithDirector = useCallback(async () => {
    if (!canPlanMovie(project)) {
      setPlanStartError(
        project.story.trim()
          ? "Add starting frame A before planning."
          : "Enter a journey story or add starting frame A.",
      );
      return;
    }
    if (journeyAgentIsBusy(journeyAgent)) {
      return;
    }
    setPlanStartError(null);
    if (project.agency === "autonomous") {
      setJourneyAgent(idleJourneyAgentSnapshot());
      await runAutonomousJourney();
      return;
    }
    setDirectorStatus("planning");
    let current = project;
    try {
      if (canGenerateOpeningFrame(current)) {
        current = await generateOpeningOn(current);
      }
      current = await writeStoryFromOpeningOn(current);
      current = await planDirectorOn(current);
      if (current.autoGenerateAllDestinations) {
        try {
          while (true) {
            const beatId = nextConstructableDestinationId(current);
            if (!beatId) {
              break;
            }
            current = await constructDestinationOn(current, beatId);
          }
        } catch {
          // Sequential construction stopped; the Director plan remains.
        }
      }
      if (current.autoBlockShots) {
        try {
          for (const journey of journeysReadyToBlock(current)) {
            current = await assessJourneyOn(current, journey.id);
          }
        } catch {
          // Sequential blocking stopped; earlier blocked legs remain.
        }
      }
      if (current.autoShoot) {
        try {
          for (const journey of journeysReadyToAutoShoot(current)) {
            current = await shootJourneyOn(current, journey.id);
          }
        } catch {
          // Sequential shooting stopped; earlier takes remain.
        }
      }
    } catch (error) {
      setDirectorStatus("error");
      const message = error instanceof Error ? error.message : "Director planning failed";
      setConversation((entries) => {
        const planning = [...entries]
          .reverse()
          .find((entry) => entry.kind === "director" && entry.status === "planning");
        if (!planning || planning.kind !== "director") {
          return entries;
        }
        return resolveDirectorEntry(entries, planning.id, {
          status: "failed",
          error: message,
        });
      });
    }
  }, [
    assessJourneyOn,
    constructDestinationOn,
    generateOpeningOn,
    journeyAgent,
    planDirectorOn,
    project,
    runAutonomousJourney,
    shootJourneyOn,
    writeStoryFromOpeningOn,
  ]);

  const exportMovie = useCallback(async () => {
    setExportMovieError(null);
    setExportingMovie(true);
    try {
      const result = await requestExportMovie(project);
      setMovieExport(result);
    } catch (error) {
      setExportMovieError(error instanceof Error ? error.message : "Movie export failed");
    } finally {
      setExportingMovie(false);
    }
  }, [project]);

  const selectedJourney = useMemo(() => {
    if (selection.kind !== "journey") {
      return null;
    }
    return project.journeys.find((journey) => journey.id === selection.journeyId) ?? null;
  }, [project.journeys, selection]);

  const value = useMemo(
    () => ({
      project,
      view,
      setView,
      selection,
      select,
      zoom,
      setZoom,
      playheadTime,
      setPlayheadTime,
      playing,
      setPlaying,
      debugOn,
      setDebugOn,
      conversationRailOpen,
      setConversationRailOpen,
      projectRailOpen,
      setProjectRailOpen,
      inspectorOpen,
      setInspectorOpen,
      storyboardReelId,
      setStoryboardReelId,
      setAgency,
      setVideoModel,
      setVideoModelForIntent,
      setDefaultTakeIntent,
      setKlingV3Mode,
      setImageModel,
      setImageOutputFormat,
      setImageResolution,
      syncJourneyClipDuration,
      composerDraft,
      setComposerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      journeyAgent,
      planWithDirector,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      shootingJourneyIds,
      shootError,
      shootJourney,
      shootAllJourneys,
      selectTake,
      cutPlaybackJourneyId,
      cutStartOffset,
      playCurrentCut,
      pauseCurrentCut,
      seekCutPrevious,
      seekCutNext,
      advanceCutClip,
      downloadCurrentCut,
      downloadingCut,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      appendDestinationWithImage,
      addDestination,
      openStoryboardInPlan,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
      setDestinationPlan,
      reshootDestination,
      movieExport,
      exportingMovie,
      exportMovieError,
      exportMovie,
    }),
    [
      project,
      view,
      setView,
      selection,
      select,
      zoom,
      setZoom,
      playheadTime,
      playing,
      debugOn,
      conversationRailOpen,
      projectRailOpen,
      inspectorOpen,
      storyboardReelId,
      setAgency,
      setVideoModel,
      setVideoModelForIntent,
      setDefaultTakeIntent,
      setKlingV3Mode,
      setImageModel,
      setImageOutputFormat,
      setImageResolution,
      syncJourneyClipDuration,
      composerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      journeyAgent,
      planWithDirector,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      shootingJourneyIds,
      shootError,
      shootJourney,
      shootAllJourneys,
      selectTake,
      cutPlaybackJourneyId,
      cutStartOffset,
      playCurrentCut,
      pauseCurrentCut,
      seekCutPrevious,
      seekCutNext,
      advanceCutClip,
      downloadCurrentCut,
      downloadingCut,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      appendDestinationWithImage,
      addDestination,
      openStoryboardInPlan,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
      setDestinationPlan,
      reshootDestination,
      movieExport,
      exportingMovie,
      exportMovieError,
      exportMovie,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return value;
}
