import { canAssessJourney, hasCurrentMotionPlan, journeysReadyToBlock } from "./cinematographer";
import { canGenerateOpeningFrame, nextConstructableDestinationId } from "./destination";
import { canExportMovie, exportMovieUnavailableReason, type MovieExportResult } from "./export-movie";
import { canShootJourney } from "./shoot";
import { hasAuthoritativeStartingFrame } from "./starting-frame";
import { journeyHasTakes, journeyTakes } from "./takes";
import type { Project } from "./types";

export type JourneyAgentPhase =
  | "IDLE"
  | "ESTABLISHING_START"
  | "DIRECTING"
  | "CONSTRUCTING"
  | "PLANNING_MOTION"
  | "SHOOTING"
  | "ASSEMBLING"
  | "COMPLETE"
  | "FAILED";

export type JourneyAgentActivity = {
  message: string;
  destinationId?: string;
  journeyId?: string;
};

export type JourneyAgentEvent = {
  phase: JourneyAgentPhase;
  activity: string;
  destinationId?: string;
  journeyId?: string;
};

export type JourneyAgentSnapshot = {
  phase: JourneyAgentPhase;
  activity: JourneyAgentActivity | null;
  events: JourneyAgentEvent[];
  failureReason?: string;
};

export type JourneyAgentOperations = {
  generateOpening: (project: Project) => Promise<Project>;
  writeStoryFromOpening: (project: Project) => Promise<Project>;
  planJourney: (project: Project) => Promise<Project>;
  constructDestination: (project: Project, beatId: string) => Promise<Project>;
  planMotion: (project: Project, journeyId: string) => Promise<Project>;
  createTake: (project: Project, journeyId: string) => Promise<Project>;
  assembleMovie: (project: Project) => Promise<{ project: Project; export: MovieExportResult }>;
};

export type JourneyAgentResult = {
  project: Project;
  snapshot: JourneyAgentSnapshot;
  movieExport?: MovieExportResult;
};

const TERMINAL_PHASES: ReadonlySet<JourneyAgentPhase> = new Set(["IDLE", "COMPLETE", "FAILED"]);

export function idleJourneyAgentSnapshot(): JourneyAgentSnapshot {
  return { phase: "IDLE", activity: null, events: [] };
}

export function journeyAgentIsBusy(snapshot: JourneyAgentSnapshot): boolean {
  return !TERMINAL_PHASES.has(snapshot.phase);
}

export function formatJourneyAgentButtonLabel(snapshot: JourneyAgentSnapshot): string | null {
  if (!journeyAgentIsBusy(snapshot) || !snapshot.activity?.message) {
    return null;
  }
  const message = snapshot.activity.message.trim();
  const capped = message.charAt(0).toUpperCase() + message.slice(1);
  return capped.endsWith("…") ? capped : `${capped}…`;
}

function journeyLabel(journeyId: string): string {
  return journeyId.replaceAll("-", "→");
}

export function runJourneyAgent(
  project: Project,
  operations: JourneyAgentOperations,
  onSnapshot?: (snapshot: JourneyAgentSnapshot) => void,
): Promise<JourneyAgentResult> {
  return executeJourneyAgent(project, operations, onSnapshot);
}

async function executeJourneyAgent(
  initial: Project,
  operations: JourneyAgentOperations,
  onSnapshot?: (snapshot: JourneyAgentSnapshot) => void,
): Promise<JourneyAgentResult> {
  let project = initial;
  let snapshot = idleJourneyAgentSnapshot();
  let movieExport: MovieExportResult | undefined;

  const emit = (
    phase: JourneyAgentPhase,
    activity: JourneyAgentActivity | null,
    extra?: { failureReason?: string },
  ) => {
    const events =
      activity == null
        ? snapshot.events
        : [
            ...snapshot.events,
            {
              phase,
              activity: activity.message,
              ...(activity.destinationId ? { destinationId: activity.destinationId } : {}),
              ...(activity.journeyId ? { journeyId: activity.journeyId } : {}),
            },
          ];
    snapshot = {
      phase,
      activity,
      events,
      ...(extra?.failureReason ? { failureReason: extra.failureReason } : {}),
    };
    onSnapshot?.(snapshot);
  };

  try {
    if (canGenerateOpeningFrame(project)) {
      emit("ESTABLISHING_START", {
        message: "generating opening destination A",
        destinationId: "A",
      });
      project = await operations.generateOpening(project);
    }

    if (!project.story.trim()) {
      if (!hasAuthoritativeStartingFrame(project)) {
        throw new Error("Enter a journey story or add starting frame A.");
      }
      emit("DIRECTING", { message: "directing journey" });
      project = await operations.writeStoryFromOpening(project);
    }

    emit("DIRECTING", { message: "directing journey" });
    project = await operations.planJourney(project);

    while (true) {
      const beatId = nextConstructableDestinationId(project);
      if (!beatId) {
        break;
      }
      emit("CONSTRUCTING", {
        message: `generating destination ${beatId}`,
        destinationId: beatId,
      });
      project = await operations.constructDestination(project, beatId);
    }

    for (const journeyId of journeysReadyToBlock(project).map((journey) => journey.id)) {
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey || hasCurrentMotionPlan(project, journey)) {
        continue;
      }
      emit("PLANNING_MOTION", {
        message: `planning ${journeyLabel(journeyId)}`,
        journeyId: journeyId,
      });
      project = await operations.planMotion(project, journeyId);
      const planned = project.journeys.find((item) => item.id === journeyId);
      if (!planned || !hasCurrentMotionPlan(project, planned)) {
        throw new Error(`Motion plan failed for ${journeyLabel(journeyId)}`);
      }
    }

    for (const journeyId of project.journeys.map((journey) => journey.id)) {
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(project, journey) || journeyHasTakes(journey)) {
        continue;
      }
      if (!canShootJourney(project, journey)) {
        throw new Error(`Cannot create a take for ${journeyLabel(journeyId)}`);
      }
      const takeNumber = journeyTakes(journey).length + 1;
      emit("SHOOTING", {
        message: `creating ${journeyLabel(journeyId)} TAKE ${takeNumber}`,
        journeyId: journeyId,
      });
      project = await operations.createTake(project, journeyId);
    }

    const shootableWithoutTakes = project.journeys.filter(
      (journey) => canShootJourney(project, journey) && !journeyHasTakes(journey),
    );
    if (shootableWithoutTakes.length > 0) {
      throw new Error(`Missing take for ${journeyLabel(shootableWithoutTakes[0]!.id)}`);
    }

    if (!canExportMovie(project)) {
      throw new Error(exportMovieUnavailableReason(project) || "Journey is not exportable.");
    }
    emit("ASSEMBLING", { message: "assembling journey" });
    const assembled = await operations.assembleMovie(project);
    project = assembled.project;
    movieExport = assembled.export;

    emit("COMPLETE", { message: "complete" });
    return { project, snapshot, movieExport };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "JourneyAgent failed";
    emit("FAILED", { message: failureReason }, { failureReason });
    return { project, snapshot };
  }
}
