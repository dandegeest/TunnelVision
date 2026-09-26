import { useProject } from "../project/ProjectProvider";
import { canUploadStoryboardFrame } from "../project/starting-frame";
import { canAddStoryboardDestination, nextStoryboardSlot } from "../project/storyboard";
import { journeyAgentIsBusy } from "../project/journey-agent";
import type { Destination, Selection, StoryboardFrame } from "../project/types";
import {
  boundaryContinuityAtSeam,
  type BoundaryContinuity,
} from "../project/boundary-continuity";
import { useReplaceDestinationImage } from "../app/ClearStoryboardPlanDialog";
import { StoryboardDestinationDrop } from "../app/PlanView";
import { ADD_DESTINATION_GAP_PX, ADD_DESTINATION_PX, DESTINATION_THUMB_PX, type LaidOutOccurrence } from "./geometry";
import { occurrenceIsGenerating } from "./shoot-layout";
import { DestinationItem } from "./DestinationItem";

export function DestinationsLane({
  occurrences,
  destinations,
  selection,
  continuities,
  constructingBeatId,
  storyboard,
  onSelect,
}: {
  occurrences: LaidOutOccurrence[];
  destinations: Destination[];
  selection: Selection;
  continuities: readonly BoundaryContinuity[];
  constructingBeatId?: string | null;
  storyboard: readonly StoryboardFrame[];
  onSelect: (occurrenceIndex: number, destinationId: string) => void;
}) {
  const {
    retryDestination,
    directorStatus,
    appendDestinationWithImage,
    addDestination,
    addDestinationWithImage,
    setStoryboardReelId,
    project,
    constructingBeatId: constructingId,
    journeyAgent,
  } = useProject();
  const { applyDestinationImageFile, dialog } = useReplaceDestinationImage();
  const planning = directorStatus === "planning";
  const addLocked = planning || Boolean(constructingId) || journeyAgentIsBusy(journeyAgent);
  const canAdd = canAddStoryboardDestination(project) && !addLocked;
  const last = occurrences.at(-1);
  const thumbHeight = (DESTINATION_THUMB_PX * 9) / 16;
  const addHeight = (ADD_DESTINATION_PX * 9) / 16;
  return (
    <div className="absolute inset-x-0 top-7 z-[1] h-[100px]">
      {dialog}
      {occurrences.map((occurrence) => {
        const destination = destinations.find((item) => item.id === occurrence.destinationId);
        if (!destination && !occurrence.fpo && !occurrence.image) {
          return null;
        }
        const selected =
          selection.kind === "destination" && selection.occurrenceIndex === occurrence.occurrenceIndex;
        const continuity = boundaryContinuityAtSeam(
          continuities,
          occurrence.destinationId,
          occurrence.inboundJourneyId,
          occurrence.outboundJourneyId,
        );
        const frame = storyboard.find(
          (item) => item.id === occurrence.destinationId || (item.destinationId ?? item.id) === occurrence.destinationId,
        );
        const generating = occurrenceIsGenerating(occurrence, constructingBeatId, storyboard);
        const emptyBeat = Boolean(occurrence.fpo) || !destination?.image;
        const canDropStill =
          emptyBeat &&
          !generating &&
          (frame ? canUploadStoryboardFrame(frame) : !frame);
        const item = (
          <DestinationItem
            occurrence={occurrence}
            destination={destination}
            selected={selected}
            continuity={continuity}
            generating={generating}
            planning={planning && emptyBeat}
            constructionError={generating ? undefined : frame?.constructionError}
            embedded={canDropStill}
            onRetry={
              frame
                ? () => {
                    void retryDestination(frame.id);
                  }
                : undefined
            }
            onSelect={() => onSelect(occurrence.occurrenceIndex, occurrence.destinationId)}
          />
        );
        if (!canDropStill) {
          return <span key={occurrence.occurrenceIndex}>{item}</span>;
        }
        return (
          <StoryboardDestinationDrop
            key={occurrence.occurrenceIndex}
            frameId={frame?.id ?? occurrence.destinationId}
            enabled
            className="group absolute top-0 -translate-x-1/2 text-left"
            style={{ left: occurrence.xCenter, width: DESTINATION_THUMB_PX }}
            onDropFile={(file) => {
              if (frame) {
                applyDestinationImageFile(frame.id, file);
                return;
              }
              void appendDestinationWithImage(file);
            }}
          >
            {item}
          </StoryboardDestinationDrop>
        );
      })}
      {canAdd && last ? (
        <StoryboardDestinationDrop
          frameId="add"
          enabled
          className="absolute"
          style={{
            left: last.xCenter + DESTINATION_THUMB_PX / 2 + ADD_DESTINATION_GAP_PX,
            width: ADD_DESTINATION_PX,
            top: 24 + (thumbHeight - addHeight) / 2,
          }}
          onDropFile={(file) => {
            void addDestinationWithImage(file);
          }}
        >
          <button
            type="button"
            aria-label="Add destination"
            title="Add destination"
            className="storyboard-fpo flex aspect-video w-full items-center justify-center rounded border border-dashed border-[#3a342c] text-lg leading-none text-[#9a8f7e] outline-none hover:border-[#7a7266] hover:text-[#ece7df] focus-visible:border-[#ece7df] focus-visible:text-[#ece7df]"
            onClick={() => {
              const next = nextStoryboardSlot(project.storyboard);
              if (!next) {
                return;
              }
              addDestination();
              setStoryboardReelId(next.id);
            }}
          >
            +
          </button>
        </StoryboardDestinationDrop>
      ) : null}
    </div>
  );
}
