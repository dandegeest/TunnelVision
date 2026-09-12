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
  hasCurrentMotionPlan,
  journeyMotionPlanInputKey,
  journeysReadyToBlock,
  motionPlanAutoKey,
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
  projectWithJourneyClipDuration,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneyShotTake,
  projectWithVideoModel,
  requestShootJourney,
  shootRequestFromProject,
} from "./shoot";
import { readStoryboardMediaInfo, readStoryboardMediaInfoFromUrl } from "./media-preflight";
import { hasAuthoritativeStartingFrame, projectWithReplacedFrameImage, uploadStartingFrame } from "./starting-frame";
import { canPlanMovie, projectWithAddedDestination, projectWithAutoBlockShots, projectWithAutoGenerateAllDestinations, projectWithAutoGenerateOpening, projectWithAutoShoot, projectWithDirectorPlan, projectWithNudgedStoryDuration, projectWithRemovedDestination, projectWithStoryboardBeatPlan, projectWithStoryDuration, parseStoryDurationInput, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
import {
  requestConstructDestination,
  projectWithConstructedDestination,
  destinationConstructionRequestFromProject,
  openingFrameGenerationRequestFromProject,
  projectWithGeneratedOpeningFrame,
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
  conversationTimestamp,
  prepareDirectorPlan,
  resolveBlockingEntry,
  resolveConstructionEntry,
  resolveDirectorEntry,
  resolveShootingEntry,
  type ConversationEntry,
} from "./conversation";
import { requestExportMovie, type MovieExportResult } from "./export-movie";
import { storyboardFrameById, type Agency, type ImageModelId, type ImageOutputFormat, type ImageResolution, type JourneyShot, type Project, type Selection, type VideoModelId } from "./types";
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
  setImageModel: (imageModel: ImageModelId) => void;
  setImageOutputFormat: (imageOutputFormat: ImageOutputFormat) => void;
  setImageResolution: (imageResolution: ImageResolution) => void;
  syncJourneyClipDuration: (journeyId: string, durationSeconds: number) => void;
  composerDraft: string;
  setComposerDraft: (draft: string) => void;
  setStoryDurationInput: (raw: string) => void;
  nudgeStoryDuration: (delta: 1 | -1) => void;
  setAutoGenerateOpening: (enabled: boolean) => void;
  setAutoGenerateAllDestinations: (enabled: boolean) => void;
  setAutoBlockShots: (enabled: boolean) => void;
  setAutoShoot: (enabled: boolean) => void;
  conversation: ConversationEntry[];
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  planStartError: string | null;
  planWithDirector: () => Promise<void>;
  assessingJourneyIds: readonly string[];
  cinematographerError: string | null;
  retryMotionPlan: (journeyId: string) => Promise<void>;
  shootingJourneyIds: readonly string[];
  shootError: string | null;
  shootJourney: (journeyId: string) => Promise<void>;
  startingFrameError: string | null;
  replacingStart: boolean;
  replaceDestinationImage: (frameId: string, file: File, options?: { clearPlan?: boolean }) => Promise<void>;
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
const inFlightMotionPlanKeys = new Set<string>();

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
  const [playing, setPlaying] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>(initialDirectorStatus);
  const [planStartError, setPlanStartError] = useState<string | null>(null);
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

  const nextConversationId = useCallback((prefix: string) => {
    conversationId.current += 1;
    return `${prefix}-${conversationId.current}`;
  }, []);

  const select = useCallback((next: Selection) => {
    commitActiveTextEdit();
    setSelection(next);
    setPlaying(false);
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
    projectRef.current = next;
    setProject(next);
    return next;
  }, []);

  const setAutoGenerateOpening = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoGenerateOpening(current, enabled));
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

  const addDestination = useCallback(() => {
    setProject((current) => {
      if (directorStatus === "planning" || constructingBeatId || assessingJourneyIds.length > 0 || shootingJourneyIds.length > 0) {
        return current;
      }
      return projectWithAddedDestination(current);
    });
  }, [assessingJourneyIds.length, constructingBeatId, directorStatus, shootingJourneyIds.length]);

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
        const next = projectWithConstructedDestination(current, {
          beatId: request.beatId,
          mediaId: result.mediaId,
          imageUrl: result.imageUrl,
          ...(mediaInfo ? { mediaInfo } : {}),
        });
        applyProject(next);
        setConversation((entries) =>
          resolveConstructionEntry(entries, entryId, {
            status: "constructed",
            imageUrl: result.imageUrl,
          }),
        );
        setSelection({ kind: "storyboard", frameId: beatId });
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
        setSelection({ kind: "storyboard", frameId: "A" });
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

  const assessJourneyOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(current, journey) || hasCurrentMotionPlan(current, journey)) {
        return current;
      }
      const inputKey = journeyMotionPlanInputKey(current, journey);
      if (!inputKey || inFlightMotionPlanKeys.has(inputKey)) {
        return current;
      }
      inFlightMotionPlanKeys.add(inputKey);
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
        const result = await requestCinematographerAssessment(request);
        const staged = await requestMotionPlan(
          motionPlanStageRequestFromAssessment(
            journeyId,
            request.startMediaId,
            request.endMediaId,
            result.assessment,
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
              assessment: result.assessment,
            }),
          );
          return latest;
        }
        const next = projectWithMotionPlan(latest, journeyId, {
          cinematographer: result.assessment,
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
            assessment: result.assessment,
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
        inFlightMotionPlanKeys.delete(inputKey);
        setAssessingJourneyIds((ids) => withoutId(ids, journeyId));
      }
    },
    [applyProject, nextConversationId],
  );

  const shootJourneyOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canShootJourney(current, journey)) {
        throw new Error("Stage this journey before generating");
      }
      const entryId = nextConversationId("shooting");
      setShootError(null);
      setShootingJourneyIds((ids) => withId(ids, journeyId));
      const shooting = projectWithJourneyShooting(projectRef.current, journeyId);
      applyProject(shooting);
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "shooting",
          journeyId,
          status: "shooting",
        }),
      );
      try {
        const request = shootRequestFromProject(shooting, journeyId);
        const result = await requestShootJourney({ ...request, debug: debugOnRef.current });
        const next = projectWithJourneyShotTake(projectRef.current, journeyId, result);
        applyProject(next);
        setSelection((current) =>
          current.kind === "journey" && current.journeyId === journeyId
            ? { kind: "journey", journeyId, band: "footage" }
            : current,
        );
        setConversation((entries) =>
          resolveShootingEntry(entries, entryId, {
            status: "shot",
            take: result.take,
            videoUrl: result.videoUrl,
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
    [applyProject, nextConversationId],
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
        inFlightMotionPlanKeys.delete(inputKey);
      }
      await assessJourney(journeyId);
    },
    [assessJourney],
  );

  const autoMotionKey = useMemo(() => motionPlanAutoKey(project), [project]);
  useEffect(() => {
    const current = projectRef.current;
    for (const journey of journeysReadyToBlock(current)) {
      void assessJourney(journey.id);
    }
  }, [assessJourney, autoMotionKey]);

  const shootJourney = useCallback(
    async (journeyId: string) => {
      try {
        await shootJourneyOn(projectRef.current, journeyId);
      } catch {
        // Conversation already records the failure.
      }
    },
    [shootJourneyOn],
  );

  const planWithDirector = useCallback(async () => {
    if (!canPlanMovie(project)) {
      setPlanStartError(
        project.story.trim()
          ? "Add starting frame A before planning."
          : "Enter a journey story or add starting frame A.",
      );
      return;
    }
    setPlanStartError(null);
    setDirectorStatus("planning");
    let current = project;
    try {
      if (current.autoGenerateOpening && canGenerateOpeningFrame(current)) {
        current = await generateOpeningOn(current);
      }

      if (!current.story.trim()) {
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
        current = applyProject({ ...current, story });
        setComposerDraftState(story);
        setConversation((entries) =>
          resolveDirectorEntry(entries, storyId, {
            status: "complete",
            phase: "story",
            evidence: storyResult.evidence,
            summary: story,
          }),
        );
      }

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
      current = applyProject(projectWithDirectorPlan(current, result.plan));
      setConversation((entries) =>
        resolveDirectorEntry(entries, directorId, {
          status: "complete",
          evidence: result.evidence,
          summary,
        }),
      );
      setDirectorStatus("ready");
      setSelection({ kind: "storyboard", frameId: prepared.request.startFrameId });
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
  }, [applyProject, assessJourneyOn, constructDestinationOn, generateOpeningOn, nextConversationId, project, shootJourneyOn]);

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
      setImageModel,
      setImageOutputFormat,
      setImageResolution,
      syncJourneyClipDuration,
      composerDraft,
      setComposerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateOpening,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      shootingJourneyIds,
      shootError,
      shootJourney,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
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
      setImageModel,
      setImageOutputFormat,
      setImageResolution,
      syncJourneyClipDuration,
      composerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateOpening,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      shootingJourneyIds,
      shootError,
      shootJourney,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
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
