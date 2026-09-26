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
import { createNewProject, createNewProjectFromSession, UNSAVED_PROJECT_ID } from "./new-project";
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
  ensureProjectJourneyPace,
  projectWithCinematographerAssessment,
  projectWithMotionPlanError,
  projectWithoutMotionPlan,
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
  journeysForTakeBatch,
  type TakeBatchScope,
  projectWithDefaultTakeIntent,
  projectWithKlingV3Mode,
  projectWithJourneyClipDuration,
  projectWithClearedShootFailure,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneysShooting,
  projectWithJourneyShotTake,
  projectWithVideoModel,
  projectWithVideoModelForIntent,
  requestShootJourney,
  shootRequestFromProject,
} from "./shoot";
import {
  currentJourneyCanonicalPair,
  filmedTakeFitsCurrentJourney,
  mergeProjectUpdate,
  projectWithLatestJourneyTakes,
  projectWithDeletedTake,
  projectWithSelectedTake,
  projectWithSelectedTakeRow,
  projectWithDeletedTakeRow,
} from "./takes";
import { defaultTakeIntentFromProject, type GenerationIntent } from "./generation-intent";
import {
  measureOutgoingStartDrops,
  outgoingStartDropFingerprint,
  projectWithOutgoingStartDrops,
} from "./outgoing-start-drop";
import { canDownloadCurrentCut, currentCutClips, currentCutFingerprint } from "./current-cut";
import { journeyPlayheadStart, layoutShootTimeline, playheadStartForSelection } from "../timeline/shoot-layout";
import { readStoryboardMediaInfo, readStoryboardMediaInfoFromUrl } from "./media-preflight";
import { canDropAppendStoryboardDestination, hasAuthoritativeStartingFrame, projectWithReplacedFrameImage, uploadStartingFrame } from "./starting-frame";
import { canAddStoryboardDestination, canPlanMovie, projectHasExistingJourney, projectWithAddedDestination, projectWithAutoBlockShots, projectWithAutoGenerateAllDestinations, projectWithAutoShoot, projectWithGenerateAudio, projectWithPullForwardReference, projectWithDirectorPlan, projectWithNudgedStoryDuration, projectWithRemovedDestination, projectWithStoryboardBeatPlan, projectWithStoryDuration, parseStoryDurationInput, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
import { projectWithAdaptivePace, projectWithStory } from "./adaptive-pace";
import { projectWithDurationMode, projectWithFixedDurationSeconds } from "./shot-duration";
import {
  effectiveJourneyPace,
  projectWithJourneyFilmmakerDuration,
  projectWithJourneyFilmmakerPace,
} from "./journey-overrides";
import {
  requestConstructDestination,
  projectWithConstructedDestination,
  destinationConstructionRequestFromProject,
  destinationRepairRequestFromProject,
  openingFrameGenerationRequestFromProject,
  projectWithDestinationConstructionError,
  projectWithGeneratedOpeningFrame,
  projectWithRepairedCanonical,
  projectWithImageModel,
  projectWithImageOutputFormat,
  projectWithImageResolution,
  requestGenerateOpeningFrame,
  canGenerateOpeningFrame,
  canReshootDestinationFrame,
  nextConstructableDestinationId,
  canGenerateRemainingDestinationsWithoutPlanning,
} from "./destination";
import {
  appendConversationEntry,
  appendFilmmakerStory,
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
import { movieDownloadFilename, requestDownloadCurrentCut, requestExportMovie, type MovieExportResult } from "./export-movie";
import {
  chooseOpenProject as requestChooseOpenProject,
  chooseProjectsFolder as requestChooseProjectsFolder,
  createPersistedProject,
  deletePersistedProject,
  fetchAppSettings,
  listPersistedProjects,
  openPersistedProject,
  renamePersistedProject,
  revealPersistedProject,
  savePersistedProject,
  type ListedProject,
} from "./project-persistence-client";
import { sanitizeProjectFolderName } from "./persistence/paths";
import { isUntitledProjectTitle, suggestedProjectName, titleFromJourneyPrompt } from "./project-name";
import {
  appendJourneyTurn,
  appendUserTurn,
  createEmptySession,
  rebindJourneyProjectId,
  requestedSessionIdFromSearch,
  updateLastJourneyForProject,
  type AgentSession,
  type SessionJourneyStatus,
} from "./session";
import { createPersistedAgentSession, fetchPersistedAgentSession, writePersistedAgentSession } from "./session-persistence-client";
import {
  idleJourneyAgentSnapshot,
  journeyAgentIsBusy,
  runJourneyAgent,
  type JourneyAgentSnapshot,
} from "./journey-agent";
import { storyboardFrameById, type Agency, type CameraGrammar, type DurationMode, type ImageModelId, type ImageOutputFormat, type ImageResolution, type JourneyShot, type KlingV3Mode, type LocomotionPace, type Project, type Selection, type VideoModelId } from "./types";
import { cameraGrammarFromProject, cameraGrammarIsLocked, projectWithCameraGrammar } from "./camera-grammar";
import { compileStoryIdea } from "./story-idea";
import { commitActiveTextEdit } from "../ui/commit-text-edit";

function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

function withoutId(ids: string[], id: string): string[] {
  return ids.filter((item) => item !== id);
}

type DirectorStatus = "idle" | "planning" | "ready" | "error";

export type AgentSessionProjectRef = {
  project: Project;
  movieExport: MovieExportResult | null;
};

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
  setStoryIdea: (storyIdea: string) => void;
  writeStoryFromIdea: (idea?: string) => Promise<void>;
  agentComposerDraft: string;
  setAgentComposerDraft: (draft: string) => void;
  agentSession: AgentSession | null;
  agentSessionProjects: Readonly<Record<string, AgentSessionProjectRef>>;
  startNewAgentSession: () => Promise<void>;
  setStoryDurationInput: (raw: string) => void;
  nudgeStoryDuration: (delta: 1 | -1) => void;
  setAutoGenerateAllDestinations: (enabled: boolean) => void;
  setAutoBlockShots: (enabled: boolean) => void;
  setAutoShoot: (enabled: boolean) => void;
  setGenerateAudio: (enabled: boolean) => void;
  setPullForwardReferenceEnabled: (enabled: boolean) => void;
  setCameraGrammar: (grammar: CameraGrammar) => void;
  setDurationMode: (mode: DurationMode) => void;
  setFixedDurationSeconds: (seconds: number) => void;
  setAdaptivePace: (enabled: boolean) => void;
  setJourneyPace: (journeyId: string, pace: LocomotionPace) => Promise<void>;
  setJourneyDurationSeconds: (journeyId: string, seconds: number) => void;
  conversation: ConversationEntry[];
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  screenwriterStatus: "idle" | "writing";
  planStartError: string | null;
  journeyAgent: JourneyAgentSnapshot;
  planWithDirector: () => Promise<void>;
  planAgentJourney: (story: string) => Promise<void>;
  stopJourneyAgent: () => void;
  assessingJourneyIds: readonly string[];
  cinematographerError: string | null;
  retryMotionPlan: (journeyId: string) => Promise<void>;
  forceMotionPlan: (journeyId: string) => Promise<void>;
  shootingJourneyIds: readonly string[];
  shootingIntents: Readonly<Record<string, GenerationIntent>>;
  shootError: string | null;
  shootJourney: (journeyId: string, intent?: GenerationIntent) => Promise<void>;
  shootAllJourneys: (intent: GenerationIntent, scope?: TakeBatchScope) => Promise<void>;
  selectTake: (journeyId: string, takeId: string) => void;
  selectTakeRow: (rowIndex: number) => void;
  deleteTake: (journeyId: string, takeId: string) => void;
  deleteTakeRow: (rowIndex: number) => void;
  clearShootFailure: (journeyId: string) => void;
  cutPlaybackJourneyId: string | null;
  cutStartOffset: number;
  cutSeekNonce: number;
  playCurrentCut: () => void;
  playCurrentCutFromStart: () => void;
  pauseCurrentCut: () => void;
  seekCutStart: () => void;
  seekCutPrevious: () => void;
  seekCutNext: () => void;
  advanceCutClip: () => void;
  downloadCurrentCut: () => Promise<void>;
  downloadingCut: boolean;
  startingFrameError: string | null;
  replacingStart: boolean;
  replaceDestinationImage: (frameId: string, file: File, options?: { clearPlan?: boolean }) => Promise<void>;
  appendDestinationWithImage: (file: File) => Promise<void>;
  addDestinationWithImage: (file: File) => Promise<void>;
  addDestination: () => void;
  openStoryboardInPlan: (frameId: string) => void;
  removeDestination: (frameId: string) => void;
  constructingBeatId: string | null;
  constructDestination: (beatId: string) => Promise<void>;
  generateOpeningFrame: () => Promise<void>;
  setDestinationPlan: (frameId: string, next: { intent?: string; visualDescription?: string }) => void;
  setShotDirection: (journeyId: string, shotDirection: string) => void;
  reshootDestination: (frameId: string) => Promise<void>;
  retryDestination: (frameId: string) => Promise<void>;
  movieExport: MovieExportResult | null;
  exportingMovie: boolean;
  exportMovieError: string | null;
  exportMovie: () => Promise<void>;
  projectsFolder: string | null;
  persistedProjectPath: string | null;
  availableProjects: readonly ListedProject[];
  persistenceError: string | null;
  newProject: (name?: string) => Promise<void>;
  saveProject: (name?: string) => Promise<void>;
  renameProject: (name?: string) => Promise<void>;
  deleteProject: () => Promise<void>;
  openProject: (path: string) => Promise<void>;
  browseAndOpenProject: () => Promise<void>;
  revealProject: () => Promise<void>;
  chooseProjectsFolder: () => Promise<string | null>;
  setProjectTitle: (title: string) => void;
  refreshProjectList: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

/** Survives React Strict Mode remount so one canonical pair is not planned twice. */
const inFlightMotionPlans = new Map<string, Promise<Project>>();
/** Bumped when the user forces a new plan so an in-flight result cannot write back. */
const motionPlanEpoch = new Map<string, number>();
/** Segments whose cleared plan is already being replanned by an explicit force. */
const forcedMotionPlans = new Set<string>();

export function ProjectProvider({
  children,
  initialProject,
  initialConversation,
  initialComposerDraft,
  initialAgentComposerDraft = "",
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
  initialJourneyAgent,
  initialCutPlaybackJourneyId = null,
  initialPlaying = false,
  initialPersistedProjectPath = null,
  initialProjectsFolder = null,
  initialMovieExport = null,
  initialAgentSession,
  initialAgentSessionProjects = {},
}: {
  children: ReactNode;
  initialProject?: Project;
  initialConversation?: ConversationEntry[];
  initialComposerDraft?: string;
  initialAgentComposerDraft?: string;
  initialAgentSession?: AgentSession | null;
  initialAgentSessionProjects?: Readonly<Record<string, AgentSessionProjectRef>>;
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
  initialJourneyAgent?: JourneyAgentSnapshot;
  initialCutPlaybackJourneyId?: string | null;
  initialPlaying?: boolean;
  initialPersistedProjectPath?: string | null;
  initialProjectsFolder?: string | null;
  initialMovieExport?: MovieExportResult | null;
}) {
  const [project, setProject] = useState(() => initialProject ?? createNewProject());
  const projectRef = useRef(project);
  projectRef.current = project;
  const projectSessionRef = useRef(0);
  const constructingRemainingRef = useRef(false);
  const [view, setViewState] = useState<WorkspaceView>(initialView);
  const [selection, setSelection] = useState<Selection>(
    () => initialSelection ?? { kind: "storyboard", frameId: "A" },
  );
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [zoom, setZoomState] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(initialPlaying);
  const [cutPlaybackJourneyId, setCutPlaybackJourneyId] = useState<string | null>(initialCutPlaybackJourneyId);
  const [cutStartOffset, setCutStartOffset] = useState(0);
  const [cutSeekNonce, setCutSeekNonce] = useState(0);
  const [downloadingCut, setDownloadingCut] = useState(false);
  const assembledCutRef = useRef<{ fingerprint: string; result: MovieExportResult } | null>(null);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>(initialDirectorStatus);
  const [screenwriterStatus, setScreenwriterStatus] = useState<"idle" | "writing">("idle");
  const [planStartError, setPlanStartError] = useState<string | null>(null);
  const [journeyAgent, setJourneyAgent] = useState<JourneyAgentSnapshot>(
    () => initialJourneyAgent ?? idleJourneyAgentSnapshot(),
  );
  const agentAbortRef = useRef<AbortController | null>(null);
  const [assessingJourneyIds, setAssessingJourneyIds] = useState<string[]>(() => [
    ...initialAssessingJourneyIds,
  ]);
  const [cinematographerError, setCinematographerError] = useState<string | null>(null);
  const [shootingJourneyIds, setShootingJourneyIds] = useState<string[]>(() => [
    ...initialShootingJourneyIds,
  ]);
  const [shootingIntents, setShootingIntents] = useState<Record<string, GenerationIntent>>({});
  const [shootError, setShootError] = useState<string | null>(null);
  const [startingFrameError, setStartingFrameError] = useState<string | null>(null);
  const [replacingStart, setReplacingStart] = useState(false);
  const [constructingBeatId, setConstructingBeatId] = useState<string | null>(
    () => initialConstructingBeatId,
  );
  const [movieExport, setMovieExport] = useState<MovieExportResult | null>(initialMovieExport);
  const movieExportRef = useRef(movieExport);
  movieExportRef.current = movieExport;
  const [agentSession, setAgentSession] = useState<AgentSession | null>(
    () => initialAgentSession ?? null,
  );
  const agentSessionRef = useRef(agentSession);
  agentSessionRef.current = agentSession;
  const [agentSessionProjects, setAgentSessionProjects] = useState<Record<string, AgentSessionProjectRef>>(
    () => ({ ...initialAgentSessionProjects }),
  );
  const agentSessionProjectsRef = useRef(agentSessionProjects);
  agentSessionProjectsRef.current = agentSessionProjects;
  const bootstrappedAgentSessionRef = useRef(initialAgentSession !== undefined);
  const [exportingMovie, setExportingMovie] = useState(false);
  const [exportMovieError, setExportMovieError] = useState<string | null>(null);
  const [projectsFolder, setProjectsFolder] = useState<string | null>(initialProjectsFolder);
  const [persistedProjectPath, setPersistedProjectPath] = useState<string | null>(
    initialPersistedProjectPath,
  );
  const persistedProjectPathRef = useRef<string | null>(null);
  persistedProjectPathRef.current = persistedProjectPath;
  const persistedCreatedAtRef = useRef<string | undefined>(undefined);
  const [availableProjects, setAvailableProjects] = useState<ListedProject[]>([]);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const composerDraftRef = useRef(composerDraft);
  composerDraftRef.current = composerDraft;
  const [agentComposerDraft, setAgentComposerDraft] = useState(initialAgentComposerDraft);
  const [conversation, setConversation] = useState<ConversationEntry[]>(
    () => initialConversation ?? [],
  );
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  const conversationId = useRef(0);
  const agentConversationCursor = useRef(0);

  const nextConversationId = useCallback((prefix: string) => {
    conversationId.current += 1;
    return `${prefix}-${conversationId.current}`;
  }, []);

  const rememberSessionProject = useCallback((next: Project, exported: MovieExportResult | null) => {
    if (!next.id || next.id === UNSAVED_PROJECT_ID) {
      return;
    }
    const snapshot: AgentSessionProjectRef = { project: next, movieExport: exported };
    agentSessionProjectsRef.current = { ...agentSessionProjectsRef.current, [next.id]: snapshot };
    setAgentSessionProjects(agentSessionProjectsRef.current);
  }, []);

  const commitAgentSession = useCallback((next: AgentSession) => {
    agentSessionRef.current = next;
    setAgentSession(next);
    void writePersistedAgentSession(next).catch(() => undefined);
  }, []);

  const patchActiveJourney = useCallback(
    (projectId: string, status: SessionJourneyStatus) => {
      const current = agentSessionRef.current;
      if (!current) {
        return;
      }
      const next = updateLastJourneyForProject(current, projectId, { status });
      if (next !== current) {
        commitAgentSession(next);
      }
    },
    [commitAgentSession],
  );

  const startNewAgentSession = useCallback(async () => {
    const current = agentSessionRef.current;
    if (current) {
      await writePersistedAgentSession(current).catch(() => undefined);
    }
    try {
      const created = await createPersistedAgentSession();
      agentSessionRef.current = created;
      setAgentSession(created);
    } catch {
      const created = createEmptySession();
      agentSessionRef.current = created;
      setAgentSession(created);
    }
    agentSessionProjectsRef.current = {};
    setAgentSessionProjects({});
    setAgentComposerDraft("");
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
    if (next === "agent") {
      setProject((current) => (current.agency === "autonomous" ? current : { ...current, agency: "autonomous" }));
    } else if (next === "plan") {
      setProject((current) => (current.agency === "directed" ? current : { ...current, agency: "directed" }));
    }
  }, [project]);

  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next));
  }, []);

  const setAgency = useCallback((agency: Agency) => {
    setProject((current) => ({ ...current, agency }));
    if (agency === "autonomous") {
      setView("agent");
      return;
    }
    setViewState((current) => (current === "agent" ? "plan" : current));
  }, [setView]);

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
    composerDraftRef.current = draft;
    setComposerDraftState(draft);
    const current = projectRef.current;
    if (current.story === draft) {
      return;
    }
    const next = projectWithStory(current, draft);
    projectRef.current = next;
    setProject(next);
  }, []);

  const setStoryIdea = useCallback((storyIdea: string) => {
    setPlanStartError(null);
    const current = projectRef.current;
    const next = storyIdea.trim()
      ? { ...current, storyIdea }
      : { ...current, storyIdea: undefined };
    if (next.storyIdea === current.storyIdea) {
      return;
    }
    projectRef.current = next;
    setProject(next);
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

  const replaceProject = useCallback((next: Project): Project => {
    projectSessionRef.current += 1;
    agentAbortRef.current?.abort();
    agentAbortRef.current = null;
    agentConversationCursor.current = 0;
    constructingRemainingRef.current = false;
    projectRef.current = next;
    setProject(next);
    setJourneyAgent(idleJourneyAgentSnapshot());
    setShootingJourneyIds([]);
    setAssessingJourneyIds([]);
    setConstructingBeatId(null);
    setDirectorStatus("idle");
    setPlaying(false);
    setCutPlaybackJourneyId(null);
    setReplacingStart(false);
    setExportingMovie(false);
    setDownloadingCut(false);
    assembledCutRef.current = null;
    return next;
  }, []);

  const applyProject = useCallback((next: Project): Project => {
    const merged = mergeProjectUpdate(next, projectRef.current);
    projectRef.current = merged;
    setProject(merged);
    return merged;
  }, []);

  const adoptSavedProject = useCallback((persisted: Project): Project => {
    const current = projectRef.current;
    const previousId = current.id;
    const incoming = current.id === persisted.id ? current : { ...current, id: persisted.id };
    const mergedTakes = projectWithLatestJourneyTakes(persisted, incoming);
    const merged = {
      ...mergedTakes,
      story: mergedTakes.story.trim() ? mergedTakes.story : incoming.story,
    };
    projectRef.current = merged;
    setProject(merged);
    if (previousId !== merged.id) {
      const session = agentSessionRef.current;
      if (session) {
        const rebound = rebindJourneyProjectId(session, previousId, merged.id);
        if (rebound !== session) {
          commitAgentSession(rebound);
        }
      }
    }
    rememberSessionProject(merged, movieExportRef.current);
    return merged;
  }, [commitAgentSession, rememberSessionProject]);

  const setAutoBlockShots = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoBlockShots(current, enabled));
  }, []);

  const setAutoShoot = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoShoot(current, enabled));
  }, []);

  const setGenerateAudio = useCallback((enabled: boolean) => {
    setProject((current) => projectWithGenerateAudio(current, enabled));
  }, []);

  const setPullForwardReferenceEnabled = useCallback((enabled: boolean) => {
    setProject((current) => projectWithPullForwardReference(current, enabled));
  }, []);

  const setCameraGrammar = useCallback((grammar: CameraGrammar) => {
    setProject((current) =>
      cameraGrammarIsLocked(current) ? current : projectWithCameraGrammar(current, grammar),
    );
  }, []);

  const setDurationMode = useCallback((mode: DurationMode) => {
    setProject((current) => projectWithDurationMode(current, mode));
  }, []);

  const setFixedDurationSeconds = useCallback((seconds: number) => {
    setProject((current) => projectWithFixedDurationSeconds(current, seconds));
  }, []);

  const ensureJourneyPaceOn = useCallback(async (current: Project): Promise<Project> => {
    try {
      const next = await ensureProjectJourneyPace(current);
      if (next !== current) {
        return applyProject(next);
      }
      return current;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cinematographer journey pace failed";
      setCinematographerError(message);
      return current;
    }
  }, [applyProject]);

  const setAdaptivePace = useCallback(
    (enabled: boolean) => {
      const next = projectWithAdaptivePace(projectRef.current, enabled);
      applyProject(next);
      if (!enabled) {
        void ensureJourneyPaceOn(next);
      }
    },
    [applyProject, ensureJourneyPaceOn],
  );

  const restageJourneyMotionPlan = useCallback(
    async (journeyId: string) => {
      const current = projectRef.current;
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey?.cinematographer || !hasCurrentMotionPlan(current, journey)) {
        return;
      }
      const request = cinematographerRequestFromProject(current, journeyId);
      const session = projectSessionRef.current;
      try {
        const staged = await requestMotionPlan(
          motionPlanStageRequestFromAssessment(
            journeyId,
            request.startMediaId,
            request.endMediaId,
            journey.cinematographer,
            {
              cameraGrammar: cameraGrammarFromProject(current),
              debug: debugOnRef.current,
              pace: effectiveJourneyPace(journey, current),
            },
          ),
        );
        if (projectSessionRef.current !== session) {
          return;
        }
        applyProject(
          projectWithMotionPlan(projectRef.current, journeyId, {
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
          }),
        );
      } catch (error) {
        if (projectSessionRef.current !== session) {
          return;
        }
        applyProject(
          projectWithMotionPlanError(
            projectRef.current,
            journeyId,
            error instanceof Error ? error.message : "Motion Plan failed",
          ),
        );
      }
    },
    [applyProject],
  );

  const setJourneyPace = useCallback(
    async (journeyId: string, pace: LocomotionPace) => {
      const next = projectWithJourneyFilmmakerPace(projectRef.current, journeyId, pace);
      applyProject(next);
      const journey = next.journeys.find((item) => item.id === journeyId);
      if (journey && hasCurrentMotionPlan(next, journey)) {
        await restageJourneyMotionPlan(journeyId);
      }
    },
    [applyProject, restageJourneyMotionPlan],
  );

  const setJourneyDurationSeconds = useCallback((journeyId: string, seconds: number) => {
    applyProject(projectWithJourneyFilmmakerDuration(projectRef.current, journeyId, seconds));
  }, [applyProject]);

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
      setStoryboardReelId(frameId);
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

  const addDestinationWithImage = useCallback(async (file: File) => {
    const current = projectRef.current;
    if (
      directorStatus === "planning" ||
      constructingBeatId ||
      journeyAgentIsBusy(journeyAgent) ||
      !canAddStoryboardDestination(current)
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
      if (projectRef.current.storyboard.some((frame) => frame.id === beatId && frame.constructionError)) {
        applyProject(projectWithDestinationConstructionError(projectRef.current, beatId, undefined));
      }
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "construction",
          beatId,
          status: "constructing",
        }),
      );
      const session = projectSessionRef.current;
      try {
        const request = destinationConstructionRequestFromProject(current, beatId);
        const result = await requestConstructDestination(request);
        const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
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
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
        const message = error instanceof Error ? error.message : "Destination construction failed.";
        applyProject(projectWithDestinationConstructionError(projectRef.current, beatId, message));
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

  const constructRemainingDestinationsOn = useCallback(
    async (current: Project): Promise<Project> => {
      if (constructingRemainingRef.current) {
        return current;
      }
      constructingRemainingRef.current = true;
      const session = projectSessionRef.current;
      let next = current;
      try {
        while (projectRef.current.autoGenerateAllDestinations) {
          if (projectSessionRef.current !== session) {
            return projectRef.current;
          }
          const beatId = nextConstructableDestinationId(next);
          if (!beatId) {
            break;
          }
          next = await constructDestinationOn(next, beatId);
        }
      } catch {
        // Sequential construction stopped; earlier constructed destinations remain.
      } finally {
        constructingRemainingRef.current = false;
      }
      return next;
    },
    [constructDestinationOn],
  );

  const setAutoGenerateAllDestinations = useCallback(
    (enabled: boolean) => {
      const next = applyProject(projectWithAutoGenerateAllDestinations(projectRef.current, enabled));
      if (
        !enabled ||
        directorStatus === "planning" ||
        constructingBeatId ||
        journeyAgentIsBusy(journeyAgent) ||
        !canGenerateRemainingDestinationsWithoutPlanning(next)
      ) {
        return;
      }
      void constructRemainingDestinationsOn(next);
    },
    [applyProject, constructingBeatId, constructRemainingDestinationsOn, directorStatus, journeyAgent],
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
      const session = projectSessionRef.current;
      const request = destinationRepairRequestFromProject(current, beatId, input);
      const result = await requestConstructDestination(request);
      const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
      if (projectSessionRef.current !== session) {
        return projectRef.current;
      }
      const next = applyProject(
        projectWithRepairedCanonical(projectRef.current, {
          beatId: request.beatId,
          mediaId: result.mediaId,
          imageUrl: result.imageUrl,
          ...(mediaInfo ? { mediaInfo } : {}),
          reason: input.instruction,
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
      if (projectRef.current.storyboard.some((frame) => frame.id === "A" && frame.constructionError)) {
        applyProject(projectWithDestinationConstructionError(projectRef.current, "A", undefined));
      }
      setConversation((entries) =>
        appendConversationEntry(entries, {
          id: entryId,
          createdAt: conversationTimestamp(),
          kind: "construction",
          beatId: "A",
          status: "constructing",
        }),
      );
      const session = projectSessionRef.current;
      try {
        const request = openingFrameGenerationRequestFromProject(current);
        const result = await requestGenerateOpeningFrame(request);
        const mediaInfo = await readStoryboardMediaInfoFromUrl(result.imageUrl);
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
        const next = applyProject(
          projectWithGeneratedOpeningFrame(projectRef.current, {
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
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
        const message = error instanceof Error ? error.message : "Opening frame generation failed.";
        setStartingFrameError(message);
        applyProject(projectWithDestinationConstructionError(projectRef.current, "A", message));
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

  const setShotDirection = useCallback(
    (journeyId: string, shotDirection: string) => {
      const current = projectRef.current;
      const trimmed = shotDirection.trim();
      applyProject({
        ...current,
        journeys: current.journeys.map((journey) =>
          journey.id === journeyId
            ? { ...journey, shotDirection: trimmed || undefined }
            : journey,
        ),
      });
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

  const retryDestination = useCallback(
    async (frameId: string) => {
      const current = projectRef.current;
      const frame = current.storyboard.find((item) => item.id === frameId);
      if (!frame) {
        return;
      }
      if (canReshootDestinationFrame(current, frame)) {
        await reshootDestination(frameId);
        return;
      }
      if (frameId === "A") {
        await generateOpeningFrame();
        return;
      }
      await constructDestination(frameId);
    },
    [constructDestination, generateOpeningFrame, reshootDestination],
  );

  const assessCinematographerOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const paced = await ensureJourneyPaceOn(current);
      const journey = paced.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(paced, journey) || cinematographerAssessmentIsCurrent(paced, journey)) {
        return paced;
      }
      const session = projectSessionRef.current;
      setAssessingJourneyIds((ids) => withId(ids, journeyId));
      try {
        const request = cinematographerRequestFromProject(paced, journeyId);
        const result = await requestCinematographerAssessment(request);
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
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
    [applyProject, ensureJourneyPaceOn],
  );

  const assessJourneyOn = useCallback(
    async (current: Project, journeyId: string): Promise<Project> => {
      const paced = await ensureJourneyPaceOn(current);
      const journey = paced.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(paced, journey) || hasCurrentMotionPlan(paced, journey)) {
        return paced;
      }
      const inputKey = journeyMotionPlanInputKey(paced, journey);
      if (!inputKey) {
        return paced;
      }
      const pending = inFlightMotionPlans.get(inputKey);
      if (pending) {
        return pending;
      }
      const epoch = motionPlanEpoch.get(journeyId) ?? 0;
      const work = (async (): Promise<Project> => {
        const session = projectSessionRef.current;
        const entryId = nextConversationId("blocking");
        setCinematographerError(null);
        if (journey.motionPlanError) {
          applyProject(projectWithMotionPlanError(paced, journeyId, undefined));
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
          const request = cinematographerRequestFromProject(paced, journeyId);
          const reuseAssessment =
            cinematographerAssessmentIsCurrent(paced, journey) && journey.cinematographer
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
              {
                cameraGrammar: cameraGrammarFromProject(paced),
                debug: debugOnRef.current,
                pace: effectiveJourneyPace({ ...journey, cinematographer: assessment }, paced),
              },
            ),
          );
          if (projectSessionRef.current !== session) {
            return projectRef.current;
          }
          const latest = projectRef.current;
          const latestJourney = latest.journeys.find((item) => item.id === journeyId);
          if ((motionPlanEpoch.get(journeyId) ?? 0) !== epoch) {
            setConversation((entries) =>
              resolveBlockingEntry(entries, entryId, {
                status: "failed",
                error: "Motion plan restarted",
              }),
            );
            return latest;
          }
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
          if (projectSessionRef.current !== session) {
            return projectRef.current;
          }
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
          if (inFlightMotionPlans.get(inputKey) === work) {
            inFlightMotionPlans.delete(inputKey);
          }
          setAssessingJourneyIds((ids) => withoutId(ids, journeyId));
        }
      })();
      inFlightMotionPlans.set(inputKey, work);
      return work;
    },
    [applyProject, ensureJourneyPaceOn, nextConversationId],
  );

  const completeJourneyShoot = useCallback(
    async (journeyId: string, resolvedIntent: GenerationIntent, entryId: string): Promise<Project> => {
      const session = projectSessionRef.current;
      const journey = projectRef.current.journeys.find((item) => item.id === journeyId);
      const shotAgainst = journey ? currentJourneyCanonicalPair(projectRef.current, journey) : undefined;
      try {
        const request = shootRequestFromProject(projectRef.current, journeyId, resolvedIntent);
        const result = await requestShootJourney({ ...request, debug: debugOnRef.current });
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
        if (!filmedTakeFitsCurrentJourney(projectRef.current, journeyId, shotAgainst)) {
          throw new Error("Start and end frames changed before this take finished.");
        }
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
        if (projectSessionRef.current !== session) {
          return projectRef.current;
        }
        const message = error instanceof Error ? error.message : "Shoot failed";
        setShootError(message);
        const failed = projectWithJourneyShotFailed(projectRef.current, journeyId, message, resolvedIntent);
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
        setShootingIntents((current) => {
          const next = { ...current };
          delete next[journeyId];
          return next;
        });
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
      if (current.id !== projectRef.current.id) {
        throw new Error("Project switched");
      }
      const entryId = nextConversationId("shooting");
      setShootError(null);
      setShootingJourneyIds((ids) => withId(ids, journeyId));
      setShootingIntents((current) => ({ ...current, [journeyId]: resolvedIntent }));
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

  const forceMotionPlan = useCallback(
    async (journeyId: string) => {
      if (forcedMotionPlans.has(journeyId)) {
        return;
      }
      const current = projectRef.current;
      const journey = current.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(current, journey)) {
        return;
      }
      const inputKey = journeyMotionPlanInputKey(current, journey);
      if (!inputKey) {
        return;
      }
      forcedMotionPlans.add(journeyId);
      motionPlanEpoch.set(journeyId, (motionPlanEpoch.get(journeyId) ?? 0) + 1);
      inFlightMotionPlans.delete(inputKey);
      const cleared = projectWithoutMotionPlan(current, journeyId);
      applyProject(cleared);
      try {
        await assessJourneyOn(cleared, journeyId);
      } catch {
        // Conversation already records the failure.
      } finally {
        forcedMotionPlans.delete(journeyId);
      }
    },
    [applyProject, assessJourneyOn],
  );

  const autoMotionKey = useMemo(() => motionPlanAutoKey(project), [project]);
  useEffect(() => {
    if (journeyAgentIsBusy(journeyAgent)) {
      return;
    }
    const current = projectRef.current;
    for (const journey of journeysReadyToBlock(current)) {
      if (forcedMotionPlans.has(journey.id)) {
        continue;
      }
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
    async (intent: GenerationIntent, scope: TakeBatchScope = "all") => {
      const current = projectRef.current;
      const launches = journeysForTakeBatch(current, scope, intent, selectionRef.current).map((journey) => ({
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

  const selectTakeRow = useCallback(
    (rowIndex: number) => {
      applyProject(projectWithSelectedTakeRow(projectRef.current, rowIndex));
    },
    [applyProject],
  );

  const deleteTake = useCallback((journeyId: string, takeId: string) => {
    const next = projectWithDeletedTake(projectRef.current, journeyId, takeId);
    projectRef.current = next;
    setProject(next);
  }, []);

  const deleteTakeRow = useCallback((rowIndex: number) => {
    const next = projectWithDeletedTakeRow(projectRef.current, rowIndex);
    projectRef.current = next;
    setProject(next);
  }, []);

  const clearShootFailure = useCallback((journeyId: string) => {
    const next = projectWithClearedShootFailure(projectRef.current, journeyId);
    projectRef.current = next;
    setProject(next);
  }, []);

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

  const playCurrentCutFromStart = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    if (clips.length === 0) {
      return;
    }
    const first = clips[0]!;
    setCutPlaybackJourneyId(first.clip.journeyId);
    setCutStartOffset(0);
    setPlayheadTime(first.laid.startTime);
    setView("shoot");
    setPlaying(true);
  }, [laidClipsForCut]);

  const pauseCurrentCut = useCallback(() => {
    setPlaying(false);
  }, []);

  const seekCutStart = useCallback(() => {
    const clips = laidClipsForCut(projectRef.current);
    if (clips.length === 0) {
      return;
    }
    const first = clips[0]!;
    setCutPlaybackJourneyId(first.clip.journeyId);
    setCutStartOffset(0);
    setPlayheadTime(first.laid.startTime);
    setCutSeekNonce((nonce) => nonce + 1);
  }, [laidClipsForCut]);

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
    let result: MovieExportResult;
    if (cached && cached.fingerprint === fingerprint) {
      result = {
        ...cached.result,
        filename: movieDownloadFilename(current.title, movieExport?.filename, cached.result.filename),
      };
    } else {
      setDownloadingCut(true);
      setExportMovieError(null);
      try {
        const assembled = await requestDownloadCurrentCut(current, movieExport?.filename);
        result = assembled;
        assembledCutRef.current = { fingerprint, result: assembled };
      } catch (error) {
        setExportMovieError(error instanceof Error ? error.message : "Download failed");
        throw error;
      } finally {
        setDownloadingCut(false);
      }
    }
    assembledCutRef.current = { fingerprint, result };
    if (movieExport?.filename !== result.filename || movieExport?.videoUrl !== result.videoUrl) {
      setMovieExport(result);
    }
    const response = await fetch(result.videoUrl);
    if (!response.ok) {
      setExportMovieError("Download failed");
      return;
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = result.filename;
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, [movieExport?.filename, movieExport?.videoUrl]);

  const writeStoryFromOpeningOn = useCallback(
    async (current: Project): Promise<Project> => {
      if (current.story.trim()) {
        return current;
      }
      if (!hasAuthoritativeStartingFrame(current)) {
        throw new Error("Enter a journey story or add starting frame A.");
      }
      const storyId = nextConversationId("director");
      const session = projectSessionRef.current;
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
      if (projectSessionRef.current !== session) {
        return projectRef.current;
      }
      const next = applyProject({ ...projectRef.current, story });
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
      const session = projectSessionRef.current;
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
      if (projectSessionRef.current !== session) {
        return projectRef.current;
      }
      const next = applyProject(projectWithDirectorPlan(projectRef.current, result.plan));
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
    agentAbortRef.current?.abort();
    const controller = new AbortController();
    agentAbortRef.current = controller;
    const agentSession = projectSessionRef.current;
    patchActiveJourney(projectRef.current.id, "generating");
    try {
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
          if (projectSessionRef.current !== agentSession) {
            throw new Error("Project switched");
          }
          setExportingMovie(true);
          setExportMovieError(null);
          try {
            const exported = await requestExportMovie(current, movieExport?.filename);
            if (projectSessionRef.current !== agentSession) {
              throw new Error("Project switched");
            }
            setMovieExport(exported);
            assembledCutRef.current = { fingerprint: currentCutFingerprint(current), result: exported };
            rememberSessionProject(current, exported);
            patchActiveJourney(current.id, "completed");
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
        if (projectSessionRef.current !== agentSession) {
          return;
        }
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
      controller.signal,
    );
    if (projectSessionRef.current !== agentSession) {
      return;
    }
    applyProject(projectWithLatestJourneyTakes(result.project, projectRef.current));
    if (result.snapshot.phase === "FAILED") {
      patchActiveJourney(projectRef.current.id, "failed");
    } else {
      setJourneyAgent(result.snapshot);
    }
    } finally {
      if (agentAbortRef.current === controller) {
        agentAbortRef.current = null;
      }
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
    movieExport,
    patchActiveJourney,
    rememberSessionProject,
  ]);

  const stopJourneyAgent = useCallback(() => {
    agentAbortRef.current?.abort();
  }, []);

  const planWithDirector = useCallback(async () => {
    const story = projectRef.current.story.trim()
      ? projectRef.current.story
      : composerDraftRef.current;
    const planning =
      story.trim() && projectRef.current.story !== story
        ? { ...projectRef.current, story }
        : projectRef.current;
    if (planning !== projectRef.current) {
      projectRef.current = planning;
      setProject(planning);
      composerDraftRef.current = planning.story;
      setComposerDraftState(planning.story);
    }
    if (!canPlanMovie(planning)) {
      setPlanStartError(
        planning.story.trim()
          ? "Add starting frame A before planning."
          : "Enter a journey story or add starting frame A.",
      );
      if (planning.agency === "autonomous") {
        patchActiveJourney(planning.id, "failed");
      }
      return;
    }
    if (journeyAgentIsBusy(journeyAgent)) {
      return;
    }
    setPlanStartError(null);
    const submitted = planning.story.trim();
    if (submitted) {
      setConversation((entries) =>
        appendFilmmakerStory(entries, submitted, nextConversationId("filmmaker"), conversationTimestamp()),
      );
    }
    if (planning.agency === "autonomous") {
      setJourneyAgent(idleJourneyAgentSnapshot());
      await runAutonomousJourney();
      return;
    }
    setDirectorStatus("planning");
    let current = planning;
    try {
      if (canGenerateOpeningFrame(current)) {
        current = await generateOpeningOn(current);
      }
      current = await writeStoryFromOpeningOn(current);
      current = await planDirectorOn(current);
      if (current.autoGenerateAllDestinations) {
        current = await constructRemainingDestinationsOn(current);
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
    constructRemainingDestinationsOn,
    generateOpeningOn,
    journeyAgent,
    nextConversationId,
    patchActiveJourney,
    planDirectorOn,
    runAutonomousJourney,
    shootJourneyOn,
    writeStoryFromOpeningOn,
  ]);

  const exportMovie = useCallback(async () => {
    setExportMovieError(null);
    setExportingMovie(true);
    try {
      const result = await requestExportMovie(project, movieExport?.filename);
      setMovieExport(result);
    } catch (error) {
      setExportMovieError(error instanceof Error ? error.message : "Movie export failed");
    } finally {
      setExportingMovie(false);
    }
  }, [movieExport?.filename, project]);

  const refreshProjectList = useCallback(async () => {
    try {
      const listed = await listPersistedProjects();
      setProjectsFolder(listed.projectsFolder);
      setAvailableProjects(listed.projects);
    } catch {
      // Tests and a missing Vite plugin should not crash the workspace.
    }
  }, []);

  const chooseProjectsFolder = useCallback(async () => {
    try {
      const result = await requestChooseProjectsFolder();
      if (result.cancelled) {
        return projectsFolder;
      }
      const folder = result.projectsFolder ?? null;
      setProjectsFolder(folder);
      await refreshProjectList();
      return folder;
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "Could not choose a Projects Folder.");
      return null;
    }
  }, [projectsFolder, refreshProjectList]);

  const ensureProjectsFolder = useCallback(async () => {
    if (projectsFolder) {
      return projectsFolder;
    }
    const settings = await fetchAppSettings().catch(() => ({}) as { projectsFolder?: string });
    if (settings.projectsFolder) {
      setProjectsFolder(settings.projectsFolder);
      return settings.projectsFolder;
    }
    const chosen = await chooseProjectsFolder();
    if (!chosen) {
      throw Object.assign(new Error("Choose a Projects Folder first."), { code: "projects_folder_required" });
    }
    return chosen;
  }, [chooseProjectsFolder, projectsFolder]);

  const saveProject = useCallback(
    async (name?: string) => {
      setPersistenceError(null);
      const session = projectSessionRef.current;
      const current = projectRef.current;
      const story = current.story.trim() ? current.story : composerDraftRef.current;
      const titled = { ...current, story };
      const title = sanitizeProjectFolderName((name ?? suggestedProjectName(titled)).trim() || "Untitled");
      const toPersist = { ...titled, title };
      const conversationToPersist = conversationRef.current;
      if (toPersist.story !== current.story || toPersist.title !== current.title) {
        projectRef.current = toPersist;
        setProject(toPersist);
        if (toPersist.story !== composerDraftRef.current) {
          composerDraftRef.current = toPersist.story;
          setComposerDraftState(toPersist.story);
        }
      }
      try {
        if (!persistedProjectPathRef.current) {
          await ensureProjectsFolder();
          const created = await createPersistedProject({
            name: title,
            project: toPersist,
            conversation: conversationToPersist,
          });
          if (projectSessionRef.current !== session) {
            return;
          }
          persistedCreatedAtRef.current = created.createdAt;
          setPersistedProjectPath(created.path);
          adoptSavedProject({ ...created.project, title });
          if (created.missingAssets.length > 0) {
            setPersistenceError(`Saved with missing assets: ${created.missingAssets.join(", ")}`);
          }
        } else {
          const saved = await savePersistedProject({
            path: persistedProjectPathRef.current,
            project: toPersist,
            conversation: conversationToPersist,
            movieExport,
            createdAt: persistedCreatedAtRef.current,
          });
          if (projectSessionRef.current !== session) {
            return;
          }
          persistedCreatedAtRef.current = saved.createdAt;
          if (saved.project.id !== toPersist.id || saved.project.title !== toPersist.title) {
            adoptSavedProject({ ...projectRef.current, id: saved.project.id, title: saved.project.title });
          }
          if (saved.missingAssets.length > 0) {
            setPersistenceError(`Saved with missing assets: ${saved.missingAssets.join(", ")}`);
          }
        }
        await refreshProjectList();
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not save the project.");
        throw error;
      }
    },
    [adoptSavedProject, conversation, ensureProjectsFolder, movieExport, refreshProjectList],
  );

  const openProject = useCallback(
    async (path: string) => {
      setPersistenceError(null);
      try {
        const opened = await openPersistedProject(path);
        persistedCreatedAtRef.current = opened.createdAt;
        setPersistedProjectPath(opened.path);
        replaceProject(opened.project);
        setComposerDraftState(opened.project.story);
        setAgentComposerDraft("");
        setConversation(opened.conversation);
        setMovieExport(opened.movieExport ?? null);
        setViewState("plan");
        setSelection({ kind: "storyboard", frameId: opened.project.storyboard[0]?.id ?? "A" });
        if (opened.missingAssets.length > 0) {
          setPersistenceError(`Opened with missing assets: ${opened.missingAssets.join(", ")}`);
        }
        await refreshProjectList();
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not open the project.");
        throw error;
      }
    },
    [refreshProjectList, replaceProject],
  );

  const browseAndOpenProject = useCallback(async () => {
    setPersistenceError(null);
    try {
      const chosen = await requestChooseOpenProject();
      if (chosen.cancelled || !chosen.path) {
        return;
      }
      await openProject(chosen.path);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "Could not open the project.");
    }
  }, [openProject]);

  const revealProject = useCallback(async () => {
    if (!persistedProjectPath) {
      return;
    }
    setPersistenceError(null);
    try {
      await revealPersistedProject(persistedProjectPath);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "Could not open the project folder.");
    }
  }, [persistedProjectPath]);

  const deleteProject = useCallback(async () => {
    setPersistenceError(null);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const path = persistedProjectPathRef.current;
    if (path) {
      try {
        await deletePersistedProject(path);
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not delete the project.");
        throw error;
      }
    }
    persistedCreatedAtRef.current = undefined;
    setPersistedProjectPath(null);
    replaceProject(createNewProject());
    setComposerDraftState("");
    setAgentComposerDraft("");
    setConversation([]);
    setMovieExport(null);
    setViewState("plan");
    setSelection({ kind: "storyboard", frameId: "A" });
    await refreshProjectList();
  }, [refreshProjectList, replaceProject]);

  const newProject = useCallback(
    async (name?: string) => {
      const title = sanitizeProjectFolderName(name?.trim() || "UNTITLED");
      const next = { ...createNewProject(), title };
      persistedCreatedAtRef.current = undefined;
      setPersistedProjectPath(null);
      replaceProject(next);
      const session = projectSessionRef.current;
      setComposerDraftState("");
      setAgentComposerDraft("");
      setConversation([]);
      setMovieExport(null);
      setViewState("plan");
      setSelection({ kind: "storyboard", frameId: "A" });
      setPersistenceError(null);
      try {
        await ensureProjectsFolder();
        const created = await createPersistedProject({
          name: title,
          project: next,
          conversation: [],
        });
        if (projectSessionRef.current !== session) {
          return;
        }
        persistedCreatedAtRef.current = created.createdAt;
        setPersistedProjectPath(created.path);
        adoptSavedProject({ ...created.project, title: created.project.title });
        await refreshProjectList();
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not create the project.");
        throw error;
      }
    },
    [adoptSavedProject, ensureProjectsFolder, refreshProjectList, replaceProject],
  );

  const setProjectTitle = useCallback((title: string) => {
    const next = sanitizeProjectFolderName(title.trim() || "UNTITLED");
    setProject((current) => (current.title === next ? current : { ...current, title: next }));
    setMovieExport((current) => {
      if (!current) {
        return current;
      }
      const filename = movieDownloadFilename(next, current.filename, current.filename);
      if (filename === current.filename) {
        return current;
      }
      const retitled = { ...current, filename };
      if (assembledCutRef.current) {
        assembledCutRef.current = { ...assembledCutRef.current, result: retitled };
      }
      return retitled;
    });
  }, []);

  const renameProject = useCallback(
    async (name?: string) => {
      const title = sanitizeProjectFolderName((name ?? projectRef.current.title).trim() || "UNTITLED");
      setPersistenceError(null);
      if (!persistedProjectPathRef.current) {
        setProjectTitle(title);
        return;
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      const session = projectSessionRef.current;
      const current = projectRef.current;
      try {
        const renamed = await renamePersistedProject({
          path: persistedProjectPathRef.current,
          name: title,
          project: { ...current, title },
          conversation: conversationRef.current,
          movieExport,
          createdAt: persistedCreatedAtRef.current,
        });
        if (projectSessionRef.current !== session) {
          return;
        }
        persistedCreatedAtRef.current = renamed.createdAt;
        setPersistedProjectPath(renamed.path);
        adoptSavedProject({ ...projectRef.current, id: renamed.project.id, title: renamed.project.title });
        setMovieExport((current) => {
          if (!current) {
            return current;
          }
          const filename = movieDownloadFilename(renamed.project.title, current.filename, current.filename);
          if (filename === current.filename) {
            return current;
          }
          const retitled = { ...current, filename };
          if (assembledCutRef.current) {
            assembledCutRef.current = { ...assembledCutRef.current, result: retitled };
          }
          return retitled;
        });
        if (renamed.missingAssets.length > 0) {
          setPersistenceError(`Saved with missing assets: ${renamed.missingAssets.join(", ")}`);
        }
        await refreshProjectList();
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not rename the project.");
        throw error;
      }
    },
    [adoptSavedProject, conversation, movieExport, refreshProjectList, setProjectTitle],
  );

  const beginAgentJourney = useCallback(
    async (
      story: string,
      options?: { storyIdea?: string; cameraGrammar?: Project["cameraGrammar"]; title?: string },
    ) => {
      const text = story.trim();
      if (!text) {
        return;
      }
      rememberSessionProject(projectRef.current, movieExportRef.current);
      const title = sanitizeProjectFolderName(options?.title || titleFromJourneyPrompt(text) || "Untitled");
      const next = {
        ...createNewProjectFromSession(projectRef.current),
        title,
        story: text,
        storyIdea: options?.storyIdea?.trim() || undefined,
        ...(options?.cameraGrammar ? { cameraGrammar: options.cameraGrammar } : {}),
        agency: "autonomous" as const,
      };
      persistedCreatedAtRef.current = undefined;
      setPersistedProjectPath(null);
      replaceProject(next);
      const session = projectSessionRef.current;
      composerDraftRef.current = text;
      setComposerDraftState(text);
      setAgentComposerDraft("");
      setConversation([]);
      setMovieExport(null);
      setViewState("agent");
      setSelection({ kind: "storyboard", frameId: "A" });
      setPersistenceError(null);
      try {
        await ensureProjectsFolder();
        const created = await createPersistedProject({
          name: title,
          project: next,
          conversation: [],
        });
        if (projectSessionRef.current !== session) {
          return;
        }
        persistedCreatedAtRef.current = created.createdAt;
        setPersistedProjectPath(created.path);
        adoptSavedProject({
          ...created.project,
          title: created.project.title,
          story: text,
          storyIdea: next.storyIdea,
        });
        await refreshProjectList();
      } catch (error) {
        setPersistenceError(error instanceof Error ? error.message : "Could not create the project.");
      }
    },
    [adoptSavedProject, ensureProjectsFolder, refreshProjectList, rememberSessionProject, replaceProject],
  );

  const writeStoryFromIdea = useCallback(async (ideaInput?: string) => {
    const idea = (ideaInput ?? projectRef.current.storyIdea ?? "").trim();
    if (!idea) {
      setPlanStartError("Enter a story idea.");
      return;
    }
    if ((projectRef.current.storyIdea ?? "").trim() !== idea) {
      setStoryIdea(idea);
    }
    setPlanStartError(null);
    setScreenwriterStatus("writing");
    try {
      const compiled = await compileStoryIdea(idea);
      const current = projectRef.current;
      const withIdea = cameraGrammarIsLocked(current)
        ? { ...current, storyIdea: compiled.storyIdea }
        : projectWithCameraGrammar({ ...current, storyIdea: compiled.storyIdea }, compiled.cameraGrammar);
      projectRef.current = withIdea;
      setProject(withIdea);
      setComposerDraft(compiled.productionPrompt);
      const nextTitle = compiled.title ? sanitizeProjectFolderName(compiled.title) : "";
      if (nextTitle && nextTitle !== projectRef.current.title) {
        const named = { ...projectRef.current, title: nextTitle };
        projectRef.current = named;
        setProject(named);
        if (persistedProjectPathRef.current) {
          try {
            await renameProject(nextTitle);
          } catch {
            // renameProject records persistenceError. The new prompt stays.
          }
        }
      }
    } catch (error) {
      setPlanStartError(error instanceof Error ? error.message : "Screenwriter failed");
    } finally {
      setScreenwriterStatus("idle");
    }
  }, [renameProject, setComposerDraft, setStoryIdea]);

  const planAgentJourney = useCallback(
    async (story: string) => {
      const text = story.trim();
      if (!text) {
        return;
      }
      const existing = agentSessionRef.current ?? createEmptySession();
      if (!agentSessionRef.current) {
        commitAgentSession(existing);
      }
      commitAgentSession(appendUserTurn(agentSessionRef.current ?? existing, text));
      setPlanStartError(null);
      setScreenwriterStatus("writing");
      let compiled: Awaited<ReturnType<typeof compileStoryIdea>>;
      try {
        compiled = await compileStoryIdea(text);
      } catch (error) {
        setScreenwriterStatus("idle");
        setPlanStartError(error instanceof Error ? error.message : "Screenwriter failed");
        return;
      }
      setScreenwriterStatus("idle");
      if (projectHasExistingJourney(projectRef.current)) {
        await beginAgentJourney(compiled.productionPrompt, {
          storyIdea: compiled.storyIdea,
          cameraGrammar: compiled.cameraGrammar,
          title: compiled.title,
        });
      } else {
        const current = projectRef.current;
        const withIdea = cameraGrammarIsLocked(current)
          ? { ...current, storyIdea: compiled.storyIdea }
          : projectWithCameraGrammar({ ...current, storyIdea: compiled.storyIdea }, compiled.cameraGrammar);
        projectRef.current = withIdea;
        setProject(withIdea);
        setComposerDraft(compiled.productionPrompt);
        const name = compiled.title || titleFromJourneyPrompt(compiled.productionPrompt);
        try {
          if (!persistedProjectPathRef.current) {
            await saveProject(name);
          } else if (isUntitledProjectTitle(projectRef.current.title)) {
            await renameProject(name);
          }
        } catch {
          // persistenceError is already recorded on the project.
        }
      }
      if (!projectRef.current.story.trim()) {
        return;
      }
      const projectId = projectRef.current.id;
      rememberSessionProject(projectRef.current, movieExportRef.current);
      const session = agentSessionRef.current;
      if (session) {
        commitAgentSession(appendJourneyTurn(session, projectId, "planning"));
      }
      await planWithDirector();
    },
    [beginAgentJourney, commitAgentSession, planWithDirector, rememberSessionProject, renameProject, saveProject, setComposerDraft],
  );

  useEffect(() => {
    void fetchAppSettings()
      .then((settings) => {
        if (settings.projectsFolder) {
          setProjectsFolder(settings.projectsFolder);
        }
      })
      .catch(() => undefined);
    void refreshProjectList();
  }, [refreshProjectList]);

  useEffect(() => {
    if (bootstrappedAgentSessionRef.current) {
      return;
    }
    bootstrappedAgentSessionRef.current = true;
    const requested = typeof window === "undefined" ? null : requestedSessionIdFromSearch(window.location.search);
    void (requested ? fetchPersistedAgentSession(requested) : createPersistedAgentSession())
      .then((created) => {
        agentSessionRef.current = created;
        setAgentSession(created);
        return created;
      })
      .catch(() => {
        const created = createEmptySession();
        agentSessionRef.current = created;
        setAgentSession(created);
        return created;
      })
      .then(async (created) => {
        if (!requested || created.turns.length === 0) {
          return;
        }
        try {
          const listed = await listPersistedProjects();
          let openPath: string | null = null;
          for (const turn of created.turns) {
            if (turn.type !== "journey") {
              continue;
            }
            const listedProject = listed.projects.find((item) => item.id === turn.projectId);
            if (!listedProject) {
              continue;
            }
            try {
              const opened = await openPersistedProject(listedProject.path);
              rememberSessionProject(opened.project, opened.movieExport ?? null);
              if (turn.status === "completed") {
                openPath = listedProject.path;
              }
            } catch {
              // Referenced folder may have been moved.
            }
          }
          if (openPath) {
            await openProject(openPath);
            setView("agent");
          } else {
            setView("agent");
          }
        } catch {
          setView("agent");
        }
      });
  }, [openProject, rememberSessionProject, setView]);

  useEffect(() => {
    const session = agentSession;
    if (!session) {
      return;
    }
    const id = project.id;
    if (!id || id === UNSAVED_PROJECT_ID) {
      return;
    }
    const referenced = session.turns.some((turn) => turn.type === "journey" && turn.projectId === id);
    if (!referenced) {
      return;
    }
    rememberSessionProject(project, movieExport);
  }, [agentSession, movieExport, project, rememberSessionProject]);

  const seamDropFingerprint = useMemo(() => outgoingStartDropFingerprint(project), [project]);

  useEffect(() => {
    let cancelled = false;
    const fingerprint = seamDropFingerprint;
    void measureOutgoingStartDrops(projectRef.current).then((measured) => {
      if (cancelled || measured.length === 0) {
        return;
      }
      if (outgoingStartDropFingerprint(projectRef.current) !== fingerprint) {
        return;
      }
      applyProject(projectWithOutgoingStartDrops(projectRef.current, measured));
    });
    return () => {
      cancelled = true;
    };
  }, [applyProject, seamDropFingerprint]);

  useEffect(() => {
    if (!persistedProjectPath) {
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void savePersistedProject({
        path: persistedProjectPath,
        project: projectRef.current,
        conversation: conversationRef.current,
        movieExport,
        createdAt: persistedCreatedAtRef.current,
      }).catch((error) => {
        setPersistenceError(error instanceof Error ? error.message : "Autosave failed.");
      });
    }, 800);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [conversation, movieExport, persistedProjectPath, project]);

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
      setStoryIdea,
      writeStoryFromIdea,
      agentComposerDraft,
      setAgentComposerDraft,
      agentSession,
      agentSessionProjects,
      startNewAgentSession,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      setGenerateAudio,
      setPullForwardReferenceEnabled,
      setCameraGrammar,
      setDurationMode,
      setAdaptivePace,
      setFixedDurationSeconds,
      setJourneyPace,
      setJourneyDurationSeconds,
      conversation,
      selectedJourney,
      directorStatus,
      screenwriterStatus,
      planStartError,
      journeyAgent,
      planWithDirector,
      planAgentJourney,
      stopJourneyAgent,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      forceMotionPlan,
      shootingJourneyIds,
      shootingIntents,
      shootError,
      shootJourney,
      shootAllJourneys,
      selectTake,
      selectTakeRow,
      deleteTake,
      deleteTakeRow,
      clearShootFailure,
      cutPlaybackJourneyId,
      cutStartOffset,
      cutSeekNonce,
      playCurrentCut,
      playCurrentCutFromStart,
      pauseCurrentCut,
      seekCutStart,
      seekCutPrevious,
      seekCutNext,
      advanceCutClip,
      downloadCurrentCut,
      downloadingCut,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      appendDestinationWithImage,
      addDestinationWithImage,
      addDestination,
      openStoryboardInPlan,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
      setDestinationPlan,
      setShotDirection,
      reshootDestination,
      retryDestination,
      movieExport,
      exportingMovie,
      exportMovieError,
      exportMovie,
      projectsFolder,
      persistedProjectPath,
      availableProjects,
      persistenceError,
      newProject,
      saveProject,
      renameProject,
      deleteProject,
      openProject,
      browseAndOpenProject,
      revealProject,
      chooseProjectsFolder,
      setProjectTitle,
      refreshProjectList,
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
      agentComposerDraft,
      agentSession,
      agentSessionProjects,
      startNewAgentSession,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateAllDestinations,
      setAutoBlockShots,
      setAutoShoot,
      setGenerateAudio,
      setPullForwardReferenceEnabled,
      setCameraGrammar,
      setDurationMode,
      setAdaptivePace,
      setFixedDurationSeconds,
      setJourneyPace,
      setJourneyDurationSeconds,
      conversation,
      selectedJourney,
      directorStatus,
      screenwriterStatus,
      planStartError,
      journeyAgent,
      planWithDirector,
      planAgentJourney,
      stopJourneyAgent,
      assessingJourneyIds,
      cinematographerError,
      retryMotionPlan,
      forceMotionPlan,
      shootingJourneyIds,
      shootingIntents,
      shootError,
      shootJourney,
      shootAllJourneys,
      selectTake,
      selectTakeRow,
      deleteTake,
      deleteTakeRow,
      clearShootFailure,
      cutPlaybackJourneyId,
      cutStartOffset,
      cutSeekNonce,
      playCurrentCut,
      playCurrentCutFromStart,
      pauseCurrentCut,
      seekCutStart,
      seekCutPrevious,
      seekCutNext,
      advanceCutClip,
      downloadCurrentCut,
      downloadingCut,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      appendDestinationWithImage,
      addDestinationWithImage,
      addDestination,
      openStoryboardInPlan,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
      setDestinationPlan,
      setShotDirection,
      reshootDestination,
      retryDestination,
      movieExport,
      exportingMovie,
      exportMovieError,
      exportMovie,
      projectsFolder,
      persistedProjectPath,
      availableProjects,
      persistenceError,
      newProject,
      saveProject,
      renameProject,
      deleteProject,
      openProject,
      browseAndOpenProject,
      revealProject,
      chooseProjectsFolder,
      setProjectTitle,
      refreshProjectList,
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
