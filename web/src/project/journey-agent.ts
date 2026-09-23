import { actualFrameForDestination, canAssessJourney, cinematographerAssessmentIsCurrent, hasCurrentMotionPlan, projectWithoutCinematographerAssessment } from "./cinematographer";
import { canGenerateOpeningFrame, canReshootDestinationFrame, canReshootOpeningFrame, generatedStillNeedsReshoot, nextConstructableDestinationId } from "./destination";
import { projectWithSyncedProductionLegs } from "./production-legs";
import { canExportMovie, exportMovieUnavailableReason, type MovieExportResult } from "./export-movie";
import {
  JOURNEY_AGENT_REPAIR_THRESHOLDS,
  assertCanonicalRepairAllowed,
  canonicalPairNeedsRepair,
  canonicalRepairBlockReason,
  formatCanonicalRepairActivity,
  formatCanonicalRepairCompleteActivity,
  inboundJourneyForDestination,
  journeyCinematographerAssessment,
  repairCandidateFromJourney,
  type CanonicalRepairRecommendation,
} from "./journey-agent-repair";
import { canShootJourney, projectWithJourneyShotFailed, projectWithJourneyShotTake } from "./shoot";
import { hasAuthoritativeStartingFrame } from "./starting-frame";
import { journeyHasTakes, journeyTakes, selectedTakeVideoUrl } from "./takes";
import type { Project } from "./types";

export type JourneyAgentPhase =
  | "IDLE"
  | "ESTABLISHING_START"
  | "DIRECTING"
  | "CONSTRUCTING"
  | "PLANNING_MOTION"
  | "REPAIRING_CANONICALS"
  | "SHOOTING"
  | "ASSEMBLING"
  | "COMPLETE"
  | "STOPPED"
  | "FAILED";

export type JourneyAgentActivityKind =
  | "canonical-repair"
  | "canonical-repair-complete"
  | "cinematographer-evaluation"
  | "cinematographer-reevaluation"
  | "cinematographer-evaluated"
  | "cinematographer-reevaluated";

export type JourneyAgentActivity = {
  message: string;
  destinationId?: string;
  journeyId?: string;
  kind?: JourneyAgentActivityKind;
  destinationIds?: string[];
  journeyIds?: string[];
  recommendation?: CanonicalRepairRecommendation;
  instruction?: string;
  setConsistency?: number;
  traversalConfidence?: number;
  afterSetConsistency?: number;
  afterTraversalConfidence?: number;
};

export type JourneyAgentEvent = {
  phase: JourneyAgentPhase;
  activity: string;
  destinationId?: string;
  journeyId?: string;
  kind?: JourneyAgentActivityKind;
  destinationIds?: string[];
  journeyIds?: string[];
  recommendation?: CanonicalRepairRecommendation;
  instruction?: string;
  setConsistency?: number;
  traversalConfidence?: number;
  afterSetConsistency?: number;
  afterTraversalConfidence?: number;
};

export type JourneyAgentSnapshot = {
  phase: JourneyAgentPhase;
  activity: JourneyAgentActivity | null;
  events: JourneyAgentEvent[];
  failureReason?: string;
};

export type CanonicalRepairOperationInput = {
  role: "start" | "end";
  instruction: string;
  referenceMediaId?: string;
};

export type JourneyAgentOperations = {
  generateOpening: (project: Project) => Promise<Project>;
  writeStoryFromOpening: (project: Project) => Promise<Project>;
  planJourney: (project: Project) => Promise<Project>;
  constructDestination: (project: Project, beatId: string) => Promise<Project>;
  assessCinematographer: (project: Project, journeyId: string) => Promise<Project>;
  repairCanonical: (
    project: Project,
    beatId: string,
    input: CanonicalRepairOperationInput,
  ) => Promise<Project>;
  planMotion: (project: Project, journeyId: string) => Promise<Project>;
  createTake: (project: Project, journeyId: string) => Promise<Project>;
  assembleMovie: (project: Project) => Promise<{ project: Project; export: MovieExportResult }>;
};

export type JourneyAgentResult = {
  project: Project;
  snapshot: JourneyAgentSnapshot;
  movieExport?: MovieExportResult;
};

const TERMINAL_PHASES: ReadonlySet<JourneyAgentPhase> = new Set(["IDLE", "COMPLETE", "STOPPED", "FAILED"]);

export class JourneyAgentStoppedError extends Error {
  constructor() {
    super("Stopped");
    this.name = "JourneyAgentStoppedError";
  }
}

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
  if (snapshot.activity.kind === "cinematographer-evaluation") {
    return snapshot.activity.message.endsWith("…")
      ? snapshot.activity.message
      : `${snapshot.activity.message}…`;
  }
  if (snapshot.activity.kind === "cinematographer-reevaluation") {
    return snapshot.activity.message.endsWith("…")
      ? snapshot.activity.message
      : `${snapshot.activity.message}…`;
  }
  if (
    snapshot.activity.kind === "cinematographer-evaluated" ||
    snapshot.activity.kind === "cinematographer-reevaluated"
  ) {
    return snapshot.activity.message.endsWith("…")
      ? snapshot.activity.message
      : `${snapshot.activity.message}…`;
  }
  if (snapshot.activity.kind === "canonical-repair" || snapshot.phase === "REPAIRING_CANONICALS") {
    const letters =
      snapshot.activity.destinationIds?.join(" & ") ?? snapshot.activity.destinationId;
    if (snapshot.activity.kind === "canonical-repair-complete" && letters) {
      return `Reshoot complete · ${letters}…`;
    }
    if (letters) {
      return `Reshooting ${letters}…`;
    }
  }
  const message = snapshot.activity.message.trim();
  const capped = message.charAt(0).toUpperCase() + message.slice(1);
  return capped.endsWith("…") ? capped : `${capped}…`;
}

function journeyLabel(journeyId: string): string {
  return journeyId.replaceAll("-", "→");
}

function activityEventFields(activity: JourneyAgentActivity): Omit<JourneyAgentEvent, "phase" | "activity"> {
  return {
    ...(activity.destinationId ? { destinationId: activity.destinationId } : {}),
    ...(activity.journeyId ? { journeyId: activity.journeyId } : {}),
    ...(activity.kind ? { kind: activity.kind } : {}),
    ...(activity.destinationIds ? { destinationIds: activity.destinationIds } : {}),
    ...(activity.journeyIds ? { journeyIds: activity.journeyIds } : {}),
    ...(activity.recommendation ? { recommendation: activity.recommendation } : {}),
    ...(activity.instruction ? { instruction: activity.instruction } : {}),
    ...(activity.setConsistency != null ? { setConsistency: activity.setConsistency } : {}),
    ...(activity.traversalConfidence != null
      ? { traversalConfidence: activity.traversalConfidence }
      : {}),
    ...(activity.afterSetConsistency != null
      ? { afterSetConsistency: activity.afterSetConsistency }
      : {}),
    ...(activity.afterTraversalConfidence != null
      ? { afterTraversalConfidence: activity.afterTraversalConfidence }
      : {}),
  };
}

function mergeFilmedSegment(current: Project, filmed: Project, journeyId: string): Project {
  const filmedJourney = filmed.journeys.find((item) => item.id === journeyId);
  const currentJourney = current.journeys.find((item) => item.id === journeyId);
  if (!filmedJourney || !currentJourney) {
    return current;
  }
  const filmedTakes = journeyTakes(filmedJourney);
  if (filmedTakes.length <= journeyTakes(currentJourney).length) {
    return current;
  }
  const newest = filmedTakes[filmedTakes.length - 1]!;
  return projectWithJourneyShotTake(current, journeyId, {
    take: newest,
    videoUrl: newest.videoUrl || selectedTakeVideoUrl(filmedJourney) || "",
  });
}

function protectedCanonicalRepairReason(project: Project, journeyId: string): string {
  const journey = project.journeys.find((item) => item.id === journeyId);
  if (!journey?.endDestinationId) {
    return `Cannot repair ${journeyLabel(journeyId)}: unknown segment.`;
  }
  return (
    canonicalRepairBlockReason(project, journey.endDestinationId) ??
    `Cannot repair ${journeyLabel(journeyId)}: protected canonical.`
  );
}

export function runJourneyAgent(
  project: Project,
  operations: JourneyAgentOperations,
  onSnapshot?: (snapshot: JourneyAgentSnapshot) => void,
  signal?: AbortSignal,
): Promise<JourneyAgentResult> {
  return executeJourneyAgent(project, operations, onSnapshot, signal);
}

function throwIfJourneyAgentStopped(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new JourneyAgentStoppedError();
  }
}

async function executeJourneyAgent(
  initial: Project,
  operations: JourneyAgentOperations,
  onSnapshot?: (snapshot: JourneyAgentSnapshot) => void,
  signal?: AbortSignal,
): Promise<JourneyAgentResult> {
  let project = initial;
  let snapshot = idleJourneyAgentSnapshot();
  let movieExport: MovieExportResult | undefined;
    const footageTasks = new Map<string, Promise<void>>();
  const filmedSegments = new Map<string, Project>();
  const reshotDestinationIds = new Set<string>();

  const adoptProject = (next: Project) => {
    let current = next;
    for (const [journeyId, filmed] of filmedSegments) {
      current = mergeFilmedSegment(current, filmed, journeyId);
    }
    project = current;
  };

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
              ...activityEventFields(activity),
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
    throwIfJourneyAgentStopped(signal);
    if (canGenerateOpeningFrame(project)) {
      emit("ESTABLISHING_START", {
        message: "generating opening destination A",
        destinationId: "A",
      });
      adoptProject(await operations.generateOpening(project));
      throwIfJourneyAgentStopped(signal);
    }

    if (!project.story.trim()) {
      if (!hasAuthoritativeStartingFrame(project)) {
        throw new Error("Enter a journey story or add starting frame A.");
      }
      emit("DIRECTING", { message: "directing journey" });
      adoptProject(await operations.writeStoryFromOpening(project));
      throwIfJourneyAgentStopped(signal);
    }

    emit("DIRECTING", { message: "directing journey" });
    adoptProject(projectWithSyncedProductionLegs(await operations.planJourney(project)));
    throwIfJourneyAgentStopped(signal);

    const opening = project.storyboard.find((frame) => frame.id === "A");
    if (
      opening &&
      generatedStillNeedsReshoot(project, opening) &&
      canReshootOpeningFrame(project)
    ) {
      emit("ESTABLISHING_START", {
        message: "reshooting opening destination A",
        destinationId: "A",
      });
      adoptProject(projectWithSyncedProductionLegs(await operations.generateOpening(project)));
      reshotDestinationIds.add("A");
      throwIfJourneyAgentStopped(signal);
    }

    let footageFailure: Error | undefined;

    const awaitFootage = async (propagateFailure: boolean) => {
      if (footageTasks.size === 0) {
        return;
      }
      await Promise.allSettled([...footageTasks.values()]);
      throwIfJourneyAgentStopped(signal);
      if (propagateFailure && footageFailure) {
        throw footageFailure;
      }
    };

    const launchFootageFor = (journeyId: string) => {
      throwIfJourneyAgentStopped(signal);
      if (footageTasks.has(journeyId)) {
        return;
      }
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(project, journey)) {
        return;
      }
      const retakeAfterReshoot =
        reshotDestinationIds.has(journey.startDestinationId) ||
        Boolean(journey.endDestinationId && reshotDestinationIds.has(journey.endDestinationId));
      if (journeyHasTakes(journey) && !retakeAfterReshoot) {
        return;
      }
      if (!canShootJourney(project, journey)) {
        throw new Error(`Cannot create a take for ${journeyLabel(journeyId)}`);
      }
      const takeNumber = journeyTakes(journey).length + 1;
      emit("SHOOTING", {
        message: `creating ${journeyLabel(journeyId)} TAKE ${takeNumber}`,
        journeyId,
      });
      const launched = project;
      const task = (async () => {
        try {
          const filmed = await operations.createTake(launched, journeyId);
          filmedSegments.set(journeyId, filmed);
          adoptProject(project);
        } catch (error) {
          const err = error instanceof Error ? error : new Error("JourneyAgent failed");
          footageFailure ??= err;
          footageTasks.delete(journeyId);
          try {
            adoptProject(projectWithJourneyShotFailed(project, journeyId, err.message));
          } catch {
            // Keep the current project if this segment is no longer on it.
          }
        }
      })();
      footageTasks.set(journeyId, task);
    };

    const planMotionFor = async (journeyId: string) => {
      throwIfJourneyAgentStopped(signal);
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey || !canAssessJourney(project, journey) || hasCurrentMotionPlan(project, journey)) {
        return;
      }
      emit("PLANNING_MOTION", {
        message: `planning ${journeyLabel(journeyId)}`,
        journeyId,
      });
      adoptProject(await operations.planMotion(project, journeyId));
      throwIfJourneyAgentStopped(signal);
      const planned = project.journeys.find((item) => item.id === journeyId);
      if (!planned || !hasCurrentMotionPlan(project, planned)) {
        throw new Error(`Motion plan failed for ${journeyLabel(journeyId)}`);
      }
    };

    const evaluateCinematographerFor = async (journeyId: string, reevaluation: boolean) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        throwIfJourneyAgentStopped(signal);
        const journey = project.journeys.find((item) => item.id === journeyId);
        if (
          !journey ||
          !canAssessJourney(project, journey) ||
          journeyHasTakes(journey) ||
          cinematographerAssessmentIsCurrent(project, journey)
        ) {
          return;
        }
        if (attempt === 0) {
          emit("PLANNING_MOTION", {
            message: reevaluation
              ? `reevaluating ${journeyLabel(journeyId)}`
              : `evaluating ${journeyLabel(journeyId)}`,
            kind: reevaluation ? "cinematographer-reevaluation" : "cinematographer-evaluation",
            journeyId,
            journeyIds: [journeyId],
          });
        }
        adoptProject(await operations.assessCinematographer(project, journeyId));
        throwIfJourneyAgentStopped(signal);
        const next = project.journeys.find((item) => item.id === journeyId);
        if (next && cinematographerAssessmentIsCurrent(project, next)) {
          const assessment = journeyCinematographerAssessment(next);
          emit("PLANNING_MOTION", {
            message: reevaluation
              ? `reevaluated ${journeyLabel(journeyId)}`
              : `evaluated ${journeyLabel(journeyId)}`,
            kind: reevaluation ? "cinematographer-reevaluated" : "cinematographer-evaluated",
            journeyId,
            journeyIds: [journeyId],
            ...(assessment
              ? {
                  setConsistency: assessment.setConsistency,
                  traversalConfidence: assessment.traversalConfidence,
                }
              : {}),
          });
          return;
        }
        adoptProject(projectWithoutCinematographerAssessment(project, journeyId));
      }
      throw new Error(`Cinematographer evaluation is stale for ${journeyLabel(journeyId)}`);
    };

    const establishEndCanonical = async (journeyId: string) => {
      throwIfJourneyAgentStopped(signal);
      const initial = project.journeys.find((item) => item.id === journeyId);
      if (!initial || !canAssessJourney(project, initial) || journeyHasTakes(initial)) {
        return;
      }
      await evaluateCinematographerFor(journeyId, false);

      const repairAttempts = { count: 0 };
      while (true) {
        throwIfJourneyAgentStopped(signal);
        const journey = project.journeys.find((item) => item.id === journeyId);
        if (!journey || !journey.endDestinationId) {
          throw new Error(`Cinematographer evaluation is stale for ${journeyLabel(journeyId)}`);
        }
        if (!cinematographerAssessmentIsCurrent(project, journey)) {
          throw new Error(`Cinematographer evaluation is stale for ${journeyLabel(journeyId)}`);
        }
        const assessment = journeyCinematographerAssessment(journey);
        if (!assessment || !canonicalPairNeedsRepair(assessment)) {
          return;
        }
        if (repairAttempts.count >= JOURNEY_AGENT_REPAIR_THRESHOLDS.maxAttemptsPerSegment) {
          return;
        }
        const candidate = repairCandidateFromJourney(project, journey);
        if (!candidate) {
          throw new Error(protectedCanonicalRepairReason(project, journeyId));
        }
        const endId = candidate.endDestinationId;
        assertCanonicalRepairAllowed(project, [endId]);
        const startMediaId = actualFrameForDestination(project, journey.startDestinationId)?.mediaId;
        emit("REPAIRING_CANONICALS", {
          message: formatCanonicalRepairActivity({
            destinationIds: [endId],
            journeyId,
            setConsistency: candidate.setConsistency,
            traversalConfidence: candidate.traversalConfidence,
            instruction: candidate.instruction,
          }),
          destinationId: endId,
          journeyId,
          kind: "canonical-repair",
          destinationIds: [endId],
          journeyIds: [journeyId],
          recommendation: candidate.recommendation,
          instruction: candidate.instruction,
          setConsistency: candidate.setConsistency,
          traversalConfidence: candidate.traversalConfidence,
        });
        adoptProject(
          projectWithSyncedProductionLegs(
            await operations.repairCanonical(project, endId, {
              role: "end",
              instruction: candidate.instruction,
              ...(startMediaId ? { referenceMediaId: startMediaId } : {}),
            }),
          ),
        );
        throwIfJourneyAgentStopped(signal);
        repairAttempts.count += 1;
        await evaluateCinematographerFor(journeyId, true);
        const afterJourney = project.journeys.find((item) => item.id === journeyId);
        const after = journeyCinematographerAssessment(afterJourney);
        if (!afterJourney || !cinematographerAssessmentIsCurrent(project, afterJourney) || !after) {
          throw new Error(`Cinematographer evaluation is stale for ${journeyLabel(journeyId)}`);
        }
        emit("REPAIRING_CANONICALS", {
          message: formatCanonicalRepairCompleteActivity({
            destinationIds: [endId],
            beforeSetConsistency: candidate.setConsistency,
            beforeTraversalConfidence: candidate.traversalConfidence,
            afterSetConsistency: after.setConsistency,
            afterTraversalConfidence: after.traversalConfidence,
          }),
          destinationId: endId,
          journeyId,
          kind: "canonical-repair-complete",
          destinationIds: [endId],
          journeyIds: [journeyId],
          recommendation: candidate.recommendation,
          setConsistency: candidate.setConsistency,
          traversalConfidence: candidate.traversalConfidence,
          afterSetConsistency: after.setConsistency,
          afterTraversalConfidence: after.traversalConfidence,
        });
        reshotDestinationIds.add(endId);
      }
    };

    const laterBeatIds = project.storyboard.slice(1).map((frame) => frame.id);
    for (const beatId of laterBeatIds) {
      throwIfJourneyAgentStopped(signal);
      const frame = project.storyboard.find((item) => item.id === beatId);
      if (!frame) {
        continue;
      }
      if (!actualFrameForDestination(project, beatId)) {
        if (nextConstructableDestinationId(project) !== beatId) {
          throw new Error(`Cannot generate destination ${beatId}`);
        }
        emit("CONSTRUCTING", {
          message: `generating destination ${beatId}`,
          destinationId: beatId,
        });
        adoptProject(
          projectWithSyncedProductionLegs(await operations.constructDestination(project, beatId)),
        );
        throwIfJourneyAgentStopped(signal);
      } else if (
        generatedStillNeedsReshoot(project, frame) &&
        canReshootDestinationFrame(project, frame)
      ) {
        emit("CONSTRUCTING", {
          message: `reshooting destination ${beatId}`,
          destinationId: beatId,
        });
        adoptProject(
          projectWithSyncedProductionLegs(await operations.constructDestination(project, beatId)),
        );
        reshotDestinationIds.add(beatId);
        throwIfJourneyAgentStopped(signal);
      }
      const inbound = inboundJourneyForDestination(project, beatId);
      if (inbound) {
        await establishEndCanonical(inbound.id);
        await planMotionFor(inbound.id);
        launchFootageFor(inbound.id);
      }
    }

    for (const journeyId of project.journeys.map((item) => item.id)) {
      throwIfJourneyAgentStopped(signal);
      await planMotionFor(journeyId);
      launchFootageFor(journeyId);
    }

    await awaitFootage(false);
    throwIfJourneyAgentStopped(signal);
    for (const journey of project.journeys) {
      if (canShootJourney(project, journey) && !journeyHasTakes(journey)) {
        launchFootageFor(journey.id);
      }
    }
    await awaitFootage(false);
    throwIfJourneyAgentStopped(signal);
    adoptProject(project);

    const missingTake = project.journeys.find(
      (journey) => canShootJourney(project, journey) && !journeyHasTakes(journey),
    );
    if (missingTake) {
      throw footageFailure ?? new Error(`Missing take for ${journeyLabel(missingTake.id)}`);
    }
    const invalidTake = project.journeys.find(
      (journey) => journeyHasTakes(journey) && !selectedTakeVideoUrl(journey),
    );
    if (invalidTake) {
      throw new Error(`Missing take for ${journeyLabel(invalidTake.id)}`);
    }

    if (!canExportMovie(project)) {
      throw new Error(exportMovieUnavailableReason(project) || "Journey is not exportable.");
    }
    emit("ASSEMBLING", { message: "assembling journey" });
    const assembled = await operations.assembleMovie(project);
    throwIfJourneyAgentStopped(signal);
    adoptProject(assembled.project);
    movieExport = assembled.export;

    emit("COMPLETE", { message: "complete" });
    return { project, snapshot, movieExport };
  } catch (error) {
    await Promise.allSettled([...footageTasks.values()]);
    adoptProject(project);
    if (error instanceof JourneyAgentStoppedError) {
      emit("STOPPED", { message: "stopped" });
      return { project, snapshot };
    }
    const failureReason = error instanceof Error ? error.message : "JourneyAgent failed";
    emit("FAILED", { message: failureReason }, { failureReason });
    return { project, snapshot };
  }
}
