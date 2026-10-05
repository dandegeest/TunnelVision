/** One selected take inside the continuous preview and on the shoot timeline. */
export type CutSpan = {
  journeyId: string;
  mediaStart: number;
  mediaEnd: number;
  timelineStart: number;
  timelineEnd: number;
};

function spanForTimeline(time: number, spans: readonly CutSpan[]): CutSpan | undefined {
  for (const span of spans) {
    if (time <= span.timelineEnd) {
      return span;
    }
  }
  return spans[spans.length - 1];
}

function spanForMedia(time: number, spans: readonly CutSpan[]): CutSpan | undefined {
  for (const span of spans) {
    if (time <= span.mediaEnd) {
      return span;
    }
  }
  return spans[spans.length - 1];
}

/** Timeline playhead → time inside the remuxed file. */
export function mediaTimeForTimeline(time: number, spans: readonly CutSpan[]): number {
  const span = spanForTimeline(time, spans);
  if (!span) {
    return 0;
  }
  if (time <= span.timelineStart) {
    return span.mediaStart;
  }
  const timelineSpan = span.timelineEnd - span.timelineStart;
  if (timelineSpan <= 0) {
    return span.mediaStart;
  }
  const ratio = Math.min(1, (time - span.timelineStart) / timelineSpan);
  return span.mediaStart + ratio * (span.mediaEnd - span.mediaStart);
}

/** Remuxed file time → shoot timeline playhead. */
export function timelineTimeForMedia(time: number, spans: readonly CutSpan[]): number {
  const span = spanForMedia(time, spans);
  if (!span) {
    return 0;
  }
  if (time <= span.mediaStart) {
    return span.timelineStart;
  }
  const mediaSpan = span.mediaEnd - span.mediaStart;
  if (mediaSpan <= 0) {
    return span.timelineStart;
  }
  const ratio = Math.min(1, (time - span.mediaStart) / mediaSpan);
  return span.timelineStart + ratio * (span.timelineEnd - span.timelineStart);
}

export function spanAtTimeline(time: number, spans: readonly CutSpan[]): CutSpan | undefined {
  return spanForTimeline(time, spans);
}
