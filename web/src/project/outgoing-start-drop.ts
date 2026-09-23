import { outgoingStartDropIsCurrent } from "./drop-outgoing-start";
import { journeyIsPlayable } from "./policy";
import { selectedTake, selectedTakeVideoUrl } from "./takes";
import type { JourneyShot, JourneyShotTake, OutgoingStartDrop, Project } from "./types";

export type PlayableSeam = {
  incoming: JourneyShot;
  outgoing: JourneyShot;
};

export function playableOutgoingSeams(project: Project): PlayableSeam[] {
  const seams: PlayableSeam[] = [];
  for (let index = 1; index < project.journeys.length; index += 1) {
    const incoming = project.journeys[index - 1]!;
    const outgoing = project.journeys[index]!;
    if (incoming.endDestinationId !== outgoing.startDestinationId) {
      continue;
    }
    if (!journeyIsPlayable(incoming) || !journeyIsPlayable(outgoing)) {
      continue;
    }
    if (!selectedTakeVideoUrl(incoming) || !selectedTakeVideoUrl(outgoing)) {
      continue;
    }
    seams.push({ incoming, outgoing });
  }
  return seams;
}

export function outgoingStartDropFingerprint(project: Project): string {
  return playableOutgoingSeams(project)
    .map(({ incoming, outgoing }) => {
      const incomingTake = selectedTake(incoming);
      const outgoingTake = selectedTake(outgoing);
      return `${outgoing.id}:${incomingTake?.id ?? ""}:${outgoingTake?.id ?? ""}:${selectedTakeVideoUrl(incoming) ?? ""}:${selectedTakeVideoUrl(outgoing) ?? ""}`;
    })
    .join("|");
}

export function selectedTakeShowsOutgoingStartDrop(
  project: Project,
  journey: JourneyShot,
  take: JourneyShotTake,
): boolean {
  const drop = journey.outgoingStartDrop;
  if (!drop?.dropped || drop.outgoingTakeId !== take.id) {
    return false;
  }
  if (selectedTake(journey)?.id !== take.id) {
    return false;
  }
  const incoming = project.journeys.find((item) => item.id === drop.incomingJourneyId);
  return outgoingStartDropIsCurrent(drop, selectedTake(incoming)?.id, take.id);
}

export function currentOutgoingStartDrop(
  project: Project,
  journey: JourneyShot,
): OutgoingStartDrop | undefined {
  const drop = journey.outgoingStartDrop;
  const outgoingTake = selectedTake(journey);
  if (!drop || !outgoingTake?.id) {
    return undefined;
  }
  const incoming = project.journeys.find((item) => item.id === drop.incomingJourneyId);
  if (!outgoingStartDropIsCurrent(drop, selectedTake(incoming)?.id, outgoingTake.id)) {
    return undefined;
  }
  return drop;
}

export function formatOutgoingStartDropSsim(ssim: number): string {
  return ssim.toFixed(2);
}

export function formatOutgoingStartDropMae(mae: number): string {
  return mae.toFixed(1);
}

export function selectedTakeJoinsOutgoingStartDrop(
  project: Project,
  journey: JourneyShot,
  take: JourneyShotTake,
): boolean {
  if (selectedTake(journey)?.id !== take.id) {
    return false;
  }
  const seam = playableOutgoingSeams(project).find((item) => item.incoming.id === journey.id);
  if (!seam) {
    return false;
  }
  const outgoingTake = selectedTake(seam.outgoing);
  return outgoingTake ? selectedTakeShowsOutgoingStartDrop(project, seam.outgoing, outgoingTake) : false;
}

export function projectWithOutgoingStartDrop(
  project: Project,
  journeyId: string,
  drop: OutgoingStartDrop | undefined,
): Project {
  return {
    ...project,
    journeys: project.journeys.map((journey) =>
      journey.id === journeyId ? { ...journey, outgoingStartDrop: drop } : journey,
    ),
  };
}

export async function requestOutgoingStartDrop(input: {
  incomingVideoUrl: string;
  outgoingVideoUrl: string;
}): Promise<{ ssim: number; mae: number; dropped: boolean } | null> {
  const response = await fetch("/api/seam-drop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { ssim?: number; mae?: number; dropped?: boolean };
  if (typeof body.ssim !== "number" || typeof body.mae !== "number" || typeof body.dropped !== "boolean") {
    return null;
  }
  return { ssim: body.ssim, mae: body.mae, dropped: body.dropped };
}

export async function measureOutgoingStartDrops(
  project: Project,
  request: typeof requestOutgoingStartDrop = requestOutgoingStartDrop,
): Promise<Array<{ journeyId: string; drop: OutgoingStartDrop }>> {
  const measured: Array<{ journeyId: string; drop: OutgoingStartDrop }> = [];
  for (const { incoming, outgoing } of playableOutgoingSeams(project)) {
    const incomingTake = selectedTake(incoming);
    const outgoingTake = selectedTake(outgoing);
    const incomingUrl = selectedTakeVideoUrl(incoming);
    const outgoingUrl = selectedTakeVideoUrl(outgoing);
    if (!incomingTake?.id || !outgoingTake?.id || !incomingUrl || !outgoingUrl) {
      continue;
    }
    if (outgoingStartDropIsCurrent(outgoing.outgoingStartDrop, incomingTake.id, outgoingTake.id)) {
      continue;
    }
    const result = await request({ incomingVideoUrl: incomingUrl, outgoingVideoUrl: outgoingUrl });
    if (!result) {
      continue;
    }
    measured.push({
      journeyId: outgoing.id,
      drop: {
        incomingJourneyId: incoming.id,
        incomingTakeId: incomingTake.id,
        outgoingTakeId: outgoingTake.id,
        dropped: result.dropped,
        ssim: result.ssim,
        mae: result.mae,
      },
    });
  }
  return measured;
}

export function projectWithOutgoingStartDrops(
  project: Project,
  drops: readonly { journeyId: string; drop: OutgoingStartDrop }[],
): Project {
  return drops.reduce(
    (next, item) => projectWithOutgoingStartDrop(next, item.journeyId, item.drop),
    project,
  );
}
