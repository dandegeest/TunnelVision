import { movieExportPlan } from "./export-movie";
import { selectedTake, selectedTakeVideoUrl, takeClipDurationSeconds } from "./takes";
import type { Project } from "./types";

export type CurrentCutClip = {
  journeyId: string;
  takeId: string;
  videoUrl: string;
  durationSeconds: number;
};

export function requiredJourneyIds(project: Project): string[] {
  return project.journeys
    .filter((journey) => Boolean(journey.endDestinationId))
    .map((journey) => journey.id);
}

export function currentCutClips(project: Project): CurrentCutClip[] {
  const clips: CurrentCutClip[] = [];
  for (const journey of project.journeys) {
    if (!journey.endDestinationId) {
      continue;
    }
    const take = selectedTake(journey);
    const videoUrl = selectedTakeVideoUrl(journey);
    if (!take?.id || !videoUrl) {
      continue;
    }
    clips.push({
      journeyId: journey.id,
      takeId: take.id,
      videoUrl,
      durationSeconds: takeClipDurationSeconds(take, journey.durationSeconds),
    });
  }
  return clips;
}

export function currentCutFingerprint(project: Project): string {
  return requiredJourneyIds(project)
    .map((journeyId) => {
      const journey = project.journeys.find((item) => item.id === journeyId);
      if (!journey) {
        return `${journeyId}:`;
      }
      const take = selectedTake(journey);
      return `${journeyId}:${take?.id ?? ""}:${selectedTakeVideoUrl(journey) ?? ""}`;
    })
    .join("|");
}

export function currentCutDurationSeconds(project: Project): number {
  return currentCutClips(project).reduce((sum, clip) => sum + clip.durationSeconds, 0);
}

export function canDownloadCurrentCut(project: Project): boolean {
  const required = requiredJourneyIds(project);
  if (required.length === 0) {
    return false;
  }
  return movieExportPlan(project).missing.length === 0 && required.every((journeyId) => {
    const journey = project.journeys.find((item) => item.id === journeyId);
    return Boolean(journey && selectedTakeVideoUrl(journey));
  });
}

export function downloadCurrentCutUnavailableReason(project: Project): string {
  if (requiredJourneyIds(project).length === 0) {
    return "DOWNLOAD needs a journey with selected Takes.";
  }
  if (!canDownloadCurrentCut(project)) {
    return "DOWNLOAD needs a selected Take on every required segment.";
  }
  return "";
}

export function nextCurrentCutClip(
  project: Project,
  journeyId: string | null,
): CurrentCutClip | undefined {
  if (!journeyId) {
    return undefined;
  }
  const clips = currentCutClips(project);
  const index = clips.findIndex((clip) => clip.journeyId === journeyId);
  return index >= 0 ? clips[index + 1] : undefined;
}

export type CutPlaybackSlot = { key: string; url: string };

export function emptyCutPlaybackSlot(): CutPlaybackSlot {
  return { key: "", url: "" };
}

export function cutPlaybackSlotFromClip(clip: CurrentCutClip | undefined): CutPlaybackSlot {
  if (!clip) {
    return emptyCutPlaybackSlot();
  }
  return { key: `${clip.journeyId}:${clip.takeId}`, url: clip.videoUrl };
}

/** Keep the upcoming clip on the hidden slot so advancing does not remount a cold video. */
export function reconcileCutPlaybackSlots(
  front: 0 | 1,
  slots: readonly [CutPlaybackSlot, CutPlaybackSlot],
  current: CutPlaybackSlot,
  next: CutPlaybackSlot,
): { front: 0 | 1; slots: [CutPlaybackSlot, CutPlaybackSlot] } {
  const back = (front === 0 ? 1 : 0) as 0 | 1;
  if (current.key && slots[back].key === current.key) {
    const nextSlots: [CutPlaybackSlot, CutPlaybackSlot] = [slots[0], slots[1]];
    if (nextSlots[back].url !== current.url) {
      nextSlots[back] = current;
    }
    return { front: back, slots: nextSlots };
  }
  const nextSlots: [CutPlaybackSlot, CutPlaybackSlot] = [slots[0], slots[1]];
  if (nextSlots[front].key !== current.key || nextSlots[front].url !== current.url) {
    nextSlots[front] = current;
    nextSlots[back] = next;
    return { front, slots: nextSlots };
  }
  if (nextSlots[back].key !== next.key) {
    nextSlots[back] = next;
    return { front, slots: nextSlots };
  }
  return { front, slots: nextSlots };
}

export function formatCutClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
