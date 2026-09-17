import { runtimeMediaPreviewUrl } from "../../runtime-media-limits";
import { isTrustedMediaIdShape } from "./trusted-media-id";
import type {
  CanonicalTake,
  CanonicalTakeSource,
  StoryboardFrame,
  StoryboardImageOrigin,
  StoryboardMediaInfo,
} from "./types";

export function canonicalTakeId(frameId: string, number: number): string {
  return `${frameId}:canonical:${number}`;
}

export function canonicalTakes(frame: StoryboardFrame): CanonicalTake[] {
  if (frame.takes && frame.takes.length > 0) {
    return frame.takes.map((take, index) => withCanonicalTakeIdentity(frame.id, take, index + 1));
  }
  if (frame.image && isTrustedMediaIdShape(frame.mediaId)) {
    return [
      withCanonicalTakeIdentity(
        frame.id,
        {
          mediaId: frame.mediaId,
          imageUrl: frame.image,
          origin: frame.imageOrigin === "none" ? "generated" : frame.imageOrigin,
          generatedFrom: frame.generatedFrom,
          mediaInfo: frame.mediaInfo,
        },
        1,
      ),
    ];
  }
  return [];
}

export function selectedCanonicalTake(frame: StoryboardFrame): CanonicalTake | undefined {
  const takes = canonicalTakes(frame);
  if (takes.length < 1) {
    return undefined;
  }
  return takes.find((take) => take.id === frame.selectedTakeId) ?? takes[takes.length - 1];
}

export type AppendCanonicalTakeInput = {
  mediaId: string;
  imageUrl: string;
  origin: StoryboardImageOrigin;
  source?: CanonicalTakeSource;
  generatedFrom?: string;
  prompt?: string;
  model?: string;
  reason?: string;
  createdAt?: string;
  mediaInfo?: StoryboardMediaInfo;
  generation?: Record<string, unknown>;
};

/**
 * Append a still without destroying earlier takes. Selected take becomes current
 * `image` / `mediaId` so existing Plan/Shoot readers stay unchanged.
 */
export function frameWithAppendedCanonicalTake(
  frame: StoryboardFrame,
  input: AppendCanonicalTakeInput,
): StoryboardFrame {
  if (!isTrustedMediaIdShape(input.mediaId)) {
    throw new Error("Canonical take has no trusted media identity");
  }
  const existing = canonicalTakes(frame);
  const number = existing.length + 1;
  const take: CanonicalTake = withCanonicalTakeIdentity(
    frame.id,
    {
      mediaId: input.mediaId,
      imageUrl: input.imageUrl || runtimeMediaPreviewUrl(input.mediaId),
      origin: input.origin,
      source: input.source,
      generatedFrom: input.generatedFrom,
      prompt: input.prompt,
      model: input.model,
      reason: input.reason,
      createdAt: input.createdAt,
      mediaInfo: input.mediaInfo,
      generation: input.generation,
    },
    number,
  );
  const next: StoryboardFrame = {
    ...frame,
    image: take.imageUrl,
    mediaId: take.mediaId,
    imageOrigin: take.origin,
    generatedFrom: take.generatedFrom,
    takes: [...existing, take],
    selectedTakeId: take.id,
  };
  if (input.mediaInfo) {
    next.mediaInfo = input.mediaInfo;
  } else {
    delete next.mediaInfo;
  }
  if (!take.generatedFrom) {
    delete next.generatedFrom;
  }
  return next;
}

export function frameWithSelectedCanonicalTake(frame: StoryboardFrame, takeId: string): StoryboardFrame {
  const takes = canonicalTakes(frame);
  const take = takes.find((item) => item.id === takeId);
  if (!take) {
    return frame;
  }
  const next: StoryboardFrame = {
    ...frame,
    image: take.imageUrl ?? runtimeMediaPreviewUrl(take.mediaId),
    mediaId: take.mediaId,
    imageOrigin: take.origin,
    generatedFrom: take.generatedFrom,
    takes,
    selectedTakeId: take.id,
  };
  if (take.mediaInfo) {
    next.mediaInfo = take.mediaInfo;
  } else {
    delete next.mediaInfo;
  }
  if (!take.generatedFrom) {
    delete next.generatedFrom;
  }
  return next;
}

function withCanonicalTakeIdentity(
  frameId: string,
  take: Omit<CanonicalTake, "id" | "number"> & Partial<Pick<CanonicalTake, "id" | "number">>,
  number: number,
): CanonicalTake {
  const next: CanonicalTake = {
    ...take,
    id: take.id ?? canonicalTakeId(frameId, number),
    number: take.number ?? number,
    imageUrl: take.imageUrl || runtimeMediaPreviewUrl(take.mediaId),
  };
  return next;
}
