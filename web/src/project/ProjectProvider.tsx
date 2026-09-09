import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createNewProject } from "./new-project";
import { clampZoom } from "../timeline/geometry";
import { requestDirectorPlan } from "./director";
import {
  cinematographerRequestFromProject,
  projectWithCinematographerAssessment,
  requestCinematographerAssessment,
} from "./cinematographer";
import {
  canShootJourney,
  projectWithJourneyShotFailed,
  projectWithJourneyShooting,
  projectWithJourneyShotTake,
  requestShootJourney,
  shootRequestFromProject,
} from "./shoot";
import { readStoryboardMediaInfo } from "./media-preflight";
import { hasAuthoritativeStartingFrame, projectWithReplacedFrameImage, uploadStartingFrame } from "./starting-frame";
import { canPlanMovie, projectWithAddedDestination, projectWithAutoGenerateAllDestinations, projectWithAutoGenerateOpening, projectWithDirectorPlan, projectWithNudgedStoryDuration, projectWithRemovedDestination, projectWithStoryDuration, parseStoryDurationInput, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
import {
  requestConstructDestination,
  projectWithConstructedDestination,
  destinationConstructionRequestFromProject,
  openingFrameGenerationRequestFromProject,
  projectWithGeneratedOpeningFrame,
  requestGenerateOpeningFrame,
  canGenerateOpeningFrame,
  nextConstructableDestinationId,
} from "./destination";
import {
  appendConversationEntry,
  conversationTimestamp,
  prepareDirectorPlan,
  resolveConstructionEntry,
  resolveDirectorEntry,
  type ConversationEntry,
} from "./conversation";
import { requestExportMovie, type MovieExportResult } from "./export-movie";
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
  projectRailOpen: boolean;
  setProjectRailOpen: (open: boolean) => void;
  setAgency: (agency: Agency) => void;
  composerDraft: string;
  setComposerDraft: (draft: string) => void;
  setStoryDurationInput: (raw: string) => void;
  nudgeStoryDuration: (delta: 1 | -1) => void;
  setAutoGenerateOpening: (enabled: boolean) => void;
  setAutoGenerateAllDestinations: (enabled: boolean) => void;
  conversation: ConversationEntry[];
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  planStartError: string | null;
  planWithDirector: () => Promise<void>;
  assessingJourneyId: string | null;
  cinematographerError: string | null;
  assessJourney: (journeyId: string) => Promise<void>;
  shootingJourneyId: string | null;
  shootError: string | null;
  shootJourney: (journeyId: string) => Promise<void>;
  startingFrameError: string | null;
  replacingStart: boolean;
  replaceDestinationImage: (frameId: string, file: File) => Promise<void>;
  addDestination: () => void;
  removeDestination: (frameId: string) => void;
  constructingBeatId: string | null;
  constructDestination: (beatId: string) => Promise<void>;
  generateOpeningFrame: () => Promise<void>;
  movieExport: MovieExportResult | null;
  exportingMovie: boolean;
  exportMovieError: string | null;
  exportMovie: () => Promise<void>;
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
  initialProjectRailOpen = true,
  initialAssessingJourneyId = null,
  initialConstructingBeatId = null,
}: {
  children: ReactNode;
  initialProject?: Project;
  initialConversation?: ConversationEntry[];
  initialComposerDraft?: string;
  initialView?: WorkspaceView;
  initialSelection?: Selection;
  initialMediaInfo?: boolean;
  initialConversationRailOpen?: boolean;
  initialProjectRailOpen?: boolean;
  initialAssessingJourneyId?: string | null;
  initialConstructingBeatId?: string | null;
}) {
  const [project, setProject] = useState(() => initialProject ?? createNewProject());
  const [view, setViewState] = useState<WorkspaceView>(initialView);
  const [selection, setSelection] = useState<Selection>(
    () => initialSelection ?? { kind: "storyboard", frameId: "A" },
  );
  const [zoom, setZoomState] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>("idle");
  const [planStartError, setPlanStartError] = useState<string | null>(null);
  const [assessingJourneyId, setAssessingJourneyId] = useState<string | null>(
    () => initialAssessingJourneyId,
  );
  const [cinematographerError, setCinematographerError] = useState<string | null>(null);
  const [shootingJourneyId, setShootingJourneyId] = useState<string | null>(null);
  const [shootError, setShootError] = useState<string | null>(null);
  const [startingFrameError, setStartingFrameError] = useState<string | null>(null);
  const [replacingStart, setReplacingStart] = useState(false);
  const [constructingBeatId, setConstructingBeatId] = useState<string | null>(
    () => initialConstructingBeatId,
  );
  const [movieExport, setMovieExport] = useState<MovieExportResult | null>(null);
  const [exportingMovie, setExportingMovie] = useState(false);
  const [exportMovieError, setExportMovieError] = useState<string | null>(null);
  const [mediaInfoOn, setMediaInfoOn] = useState(initialMediaInfo);
  const [conversationRailOpen, setConversationRailOpen] = useState(initialConversationRailOpen);
  const [projectRailOpen, setProjectRailOpen] = useState(initialProjectRailOpen);
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
    setSelection(next);
    setPlaying(false);
  }, []);

  const setView = useCallback((next: WorkspaceView) => {
    if (next === "shoot" && !hasAuthoritativeStartingFrame(project)) {
      return;
    }
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

  const setAutoGenerateOpening = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoGenerateOpening(current, enabled));
  }, []);

  const setAutoGenerateAllDestinations = useCallback((enabled: boolean) => {
    setProject((current) => projectWithAutoGenerateAllDestinations(current, enabled));
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
    setProject((current) => {
      if (directorStatus === "planning" || constructingBeatId) {
        return current;
      }
      return projectWithAddedDestination(current);
    });
  }, [constructingBeatId, directorStatus]);

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
        const next = projectWithConstructedDestination(current, {
          beatId: request.beatId,
          mediaId: result.mediaId,
          imageUrl: result.imageUrl,
        });
        setProject(next);
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
    [nextConversationId],
  );

  const constructDestination = useCallback(
    async (beatId: string) => {
      try {
        await constructDestinationOn(project, beatId);
      } catch {
        // Conversation already records the failure.
      }
    },
    [constructDestinationOn, project],
  );

  const generateOpeningFrame = useCallback(async () => {
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
      const request = openingFrameGenerationRequestFromProject(project);
      const result = await requestGenerateOpeningFrame(request);
      setProject((current) =>
        projectWithGeneratedOpeningFrame(current, {
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
      setSelection({ kind: "storyboard", frameId: "A" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Opening frame generation failed.";
      setStartingFrameError(message);
      setConversation((entries) =>
        resolveConstructionEntry(entries, entryId, {
          status: "failed",
          error: message,
        }),
      );
    } finally {
      setConstructingBeatId(null);
    }
  }, [nextConversationId, project]);

  const planWithDirector = useCallback(async () => {
    if (!canPlanMovie(project)) {
      setPlanStartError(
        project.story.trim()
          ? "Add starting frame A before planning."
          : "Director requires a filmmaker story",
      );
      return;
    }
    setPlanStartError(null);
    setDirectorStatus("planning");
    let current = project;
    try {
      if (current.autoGenerateOpening && canGenerateOpeningFrame(current)) {
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
          current = projectWithGeneratedOpeningFrame(current, {
            mediaId: result.mediaId,
            imageUrl: result.imageUrl,
          });
          setProject(current);
          setConversation((entries) =>
            resolveConstructionEntry(entries, entryId, {
              status: "constructed",
              imageUrl: result.imageUrl,
            }),
          );
          setSelection({ kind: "storyboard", frameId: "A" });
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
        }),
      );
      const result = await requestDirectorPlan(prepared.request);
      const summary = result.plan.summary?.trim();
      if (!summary) {
        throw new Error("Director returned no filmmaker-facing summary");
      }
      const nextProject = projectWithDirectorPlan(current, result.plan);
      setProject(nextProject);
      setConversation((entries) =>
        resolveDirectorEntry(entries, directorId, {
          status: "complete",
          evidence: result.evidence,
          summary,
        }),
      );
      setDirectorStatus("ready");
      setSelection({ kind: "storyboard", frameId: prepared.request.startFrameId });
      current = nextProject;
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
  }, [constructDestinationOn, nextConversationId, project]);

  const assessJourney = useCallback(async (journeyId: string) => {
    setCinematographerError(null);
    setAssessingJourneyId(journeyId);
    try {
      const request = cinematographerRequestFromProject(project, journeyId);
      const result = await requestCinematographerAssessment(request);
      setProject((current) => projectWithCinematographerAssessment(current, journeyId, result.assessment));
    } catch (error) {
      setCinematographerError(
        error instanceof Error ? error.message : "Cinematographer assessment failed",
      );
    } finally {
      setAssessingJourneyId(null);
    }
  }, [project]);

  const shootJourney = useCallback(async (journeyId: string) => {
    setShootError(null);
    const journey = project.journeys.find((item) => item.id === journeyId);
    if (!journey || !canShootJourney(project, journey)) {
      setShootError("Block this journey before shooting");
      return;
    }
    setShootingJourneyId(journeyId);
    setProject((current) => projectWithJourneyShooting(current, journeyId));
    try {
      const request = shootRequestFromProject(project, journeyId);
      const result = await requestShootJourney(request);
      setProject((current) => projectWithJourneyShotTake(current, journeyId, result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shoot failed";
      setShootError(message);
      setProject((current) => projectWithJourneyShotFailed(current, journeyId, message));
    } finally {
      setShootingJourneyId(null);
    }
  }, [project]);

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
      mediaInfoOn,
      setMediaInfoOn,
      conversationRailOpen,
      setConversationRailOpen,
      projectRailOpen,
      setProjectRailOpen,
      setAgency,
      composerDraft,
      setComposerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateOpening,
      setAutoGenerateAllDestinations,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      assessingJourneyId,
      cinematographerError,
      assessJourney,
      shootingJourneyId,
      shootError,
      shootJourney,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      addDestination,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
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
      mediaInfoOn,
      conversationRailOpen,
      projectRailOpen,
      setAgency,
      composerDraft,
      setStoryDurationInput,
      nudgeStoryDuration,
      setAutoGenerateOpening,
      setAutoGenerateAllDestinations,
      conversation,
      selectedJourney,
      directorStatus,
      planStartError,
      planWithDirector,
      assessingJourneyId,
      cinematographerError,
      assessJourney,
      shootingJourneyId,
      shootError,
      shootJourney,
      startingFrameError,
      replacingStart,
      replaceDestinationImage,
      addDestination,
      removeDestination,
      constructingBeatId,
      constructDestination,
      generateOpeningFrame,
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
