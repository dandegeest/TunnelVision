import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createForestProject } from "../fixtures/forest-a-to-f";
import { clampZoom } from "../timeline/geometry";
import { requestDirectorPlan } from "./director";
import { readStoryboardMediaInfo } from "./media-preflight";
import { projectWithReplacedFrameImage, uploadStartingFrame } from "./starting-frame";
import { projectWithAddedDestination, projectWithDirectorPlan, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
import {
  requestConstructDestination,
  projectWithConstructedDestination,
  destinationConstructionRequestFromProject,
} from "./destination";
import {
  appendConversationEntry,
  conversationTimestamp,
  preparePlanSubmission,
  resolveConstructionEntry,
  resolveDirectorEntry,
  type ConversationEntry,
} from "./conversation";
import type { Agency, JourneyShot, Project, Selection } from "./types";

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
  mediaInfoOn: boolean;
  setMediaInfoOn: (on: boolean) => void;
  conversationRailOpen: boolean;
  setConversationRailOpen: (open: boolean) => void;
  setAgency: (agency: Agency) => void;
  composerDraft: string;
  setComposerDraft: (draft: string) => void;
  conversation: ConversationEntry[];
  approveJourney: (journeyId: string) => void;
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  planStartError: string | null;
  planWithDirector: () => Promise<void>;
  startingFrameError: string | null;
  replacingStart: boolean;
  replaceDestinationImage: (frameId: string, file: File) => Promise<void>;
  addDestination: () => void;
  constructingBeatId: string | null;
  constructDestination: (beatId: string) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  children,
  initialProject,
  initialConversation,
  initialComposerDraft,
  initialView = "plan",
  initialSelection,
  initialMediaInfo = false,
  initialConversationRailOpen = true,
}: {
  children: ReactNode;
  initialProject?: Project;
  initialConversation?: ConversationEntry[];
  initialComposerDraft?: string;
  initialView?: WorkspaceView;
  initialSelection?: Selection;
  initialMediaInfo?: boolean;
  initialConversationRailOpen?: boolean;
}) {
  const [project, setProject] = useState(() => initialProject ?? createForestProject());
  const [view, setViewState] = useState<WorkspaceView>(initialView);
  const [selection, setSelection] = useState<Selection>(
    () => initialSelection ?? { kind: "storyboard", frameId: "A" },
  );
  const [zoom, setZoomState] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>("idle");
  const [planStartError, setPlanStartError] = useState<string | null>(null);
  const [startingFrameError, setStartingFrameError] = useState<string | null>(null);
  const [replacingStart, setReplacingStart] = useState(false);
  const [constructingBeatId, setConstructingBeatId] = useState<string | null>(null);
  const [mediaInfoOn, setMediaInfoOn] = useState(initialMediaInfo);
  const [conversationRailOpen, setConversationRailOpen] = useState(initialConversationRailOpen);
  const [composerDraft, setComposerDraft] = useState(
    () => initialComposerDraft ?? (initialProject ?? createForestProject()).story,
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
    setSelection(next);
    setPlaying(false);
  }, []);

  const setView = useCallback((next: WorkspaceView) => {
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

  const approveJourney = useCallback((journeyId: string) => {
    setProject((current) => ({
      ...current,
      journeys: current.journeys.map((journey) =>
        journey.id === journeyId && journey.status === "needs_review"
          ? { ...journey, status: "rendered" as const }
          : journey,
      ),
    }));
  }, []);

  const replaceDestinationImage = useCallback(async (frameId: string, file: File) => {
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
    setProject((current) => projectWithAddedDestination(current));
  }, []);

  const constructDestination = useCallback(async (beatId: string) => {
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
      const request = destinationConstructionRequestFromProject(project, beatId);
      const result = await requestConstructDestination(request);
      setProject((current) =>
        projectWithConstructedDestination(current, {
          beatId: request.beatId,
          mediaId: result.mediaId,
          imageUrl: result.imageUrl,
        }),
      );
      setConversation((entries) =>
        resolveConstructionEntry(entries, entryId, {
          status: "constructed",
          imageUrl: result.imageUrl,
        }),
      );
    } catch (error) {
      setConversation((entries) =>
        resolveConstructionEntry(entries, entryId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Destination construction failed.",
        }),
      );
    } finally {
      setConstructingBeatId(null);
    }
  }, [nextConversationId, project]);

  const planWithDirector = useCallback(async () => {
    const prepared = preparePlanSubmission(composerDraft, project);
    if (!prepared.ok) {
      if (prepared.reason === "invalid") {
        setPlanStartError(prepared.message ?? "Director planning failed");
      }
      return;
    }
    setPlanStartError(null);
    setComposerDraft("");
    setProject((current) => ({ ...current, story: prepared.submitted }));
    const filmmakerId = nextConversationId("filmmaker");
    const directorId = nextConversationId("director");
    const submittedAt = conversationTimestamp();
    setConversation((entries) =>
      appendConversationEntry(
        appendConversationEntry(entries, {
          id: filmmakerId,
          createdAt: submittedAt,
          kind: "filmmaker",
          text: prepared.submitted,
        }),
        {
          id: directorId,
          createdAt: conversationTimestamp(),
          kind: "director",
          status: "planning",
        },
      ),
    );
    setDirectorStatus("planning");
    try {
      const result = await requestDirectorPlan(prepared.request);
      const summary = result.plan.summary?.trim();
      if (!summary) {
        throw new Error("Director returned no filmmaker-facing summary");
      }
      setProject((current) => projectWithDirectorPlan(current, result.plan));
      setConversation((entries) =>
        resolveDirectorEntry(entries, directorId, {
          status: "complete",
          evidence: result.evidence,
          summary,
        }),
      );
      setDirectorStatus("ready");
      setSelection({ kind: "storyboard", frameId: prepared.request.startFrameId });
    } catch (error) {
      setDirectorStatus("error");
      setConversation((entries) =>
        resolveDirectorEntry(entries, directorId, {
          status: "failed",
          error: error instanceof Error ? error.message : "Director planning failed",
        }),
      );
    }
  }, [composerDraft, nextConversationId, project]);

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
      mediaInfoOn,
      setMediaInfoOn,
      conversationRailOpen,
      setConversationRailOpen,
      setAgency,
      composerDraft,
      setComposerDraft,
      conversation,
      approveJourney,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      addDestination,
      constructingBeatId,
      constructDestination,
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
      mediaInfoOn,
      conversationRailOpen,
      setAgency,
      composerDraft,
      conversation,
      approveJourney,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      addDestination,
      constructingBeatId,
      constructDestination,
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
