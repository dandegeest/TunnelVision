import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createWardrobeProject } from "../fixtures/wardrobe-loop";
import { clampZoom } from "../timeline/geometry";
import { requestDirectorPlan, type DirectorEvidence } from "./director";
import { projectWithDirectorPlan, selectionForWorkspaceView, type WorkspaceView } from "./storyboard";
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
  setAgency: (agency: Agency) => void;
  approveJourney: (journeyId: string) => void;
  selectedJourney: JourneyShot | null;
  directorStatus: DirectorStatus;
  directorError: string | null;
  directorEvidence: DirectorEvidence | null;
  planWithDirector: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState(createWardrobeProject);
  const [view, setViewState] = useState<WorkspaceView>("plan");
  const [selection, setSelection] = useState<Selection>({
    kind: "storyboard",
    frameId: "A",
  });
  const [zoom, setZoomState] = useState(1);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>("idle");
  const [directorError, setDirectorError] = useState<string | null>(null);
  const [directorEvidence, setDirectorEvidence] = useState<DirectorEvidence | null>(null);

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

  const planWithDirector = useCallback(async () => {
    const start =
      project.storyboard.find((frame) => frame.imageOrigin === "user") ?? project.storyboard[0];
    if (!start) {
      setDirectorStatus("error");
      setDirectorError("Project has no starting storyboard frame");
      return;
    }
    setDirectorStatus("planning");
    setDirectorError(null);
    try {
      const result = await requestDirectorPlan({
        story: project.story,
        agency: project.agency,
        startFrameId: start.id,
        startFrameIntent: start.intent,
      });
      setProject((current) => projectWithDirectorPlan(current, result.plan));
      setDirectorEvidence(result.evidence);
      setDirectorStatus("ready");
      setSelection({ kind: "storyboard", frameId: start.id });
    } catch (error) {
      setDirectorStatus("error");
      setDirectorError(error instanceof Error ? error.message : "Director planning failed");
    }
  }, [project.agency, project.story, project.storyboard]);

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
      setAgency,
      approveJourney,
      selectedJourney,
      directorStatus,
      directorError,
      directorEvidence,
      planWithDirector,
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
      setAgency,
      approveJourney,
      selectedJourney,
      directorStatus,
      directorError,
      directorEvidence,
      planWithDirector,
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
