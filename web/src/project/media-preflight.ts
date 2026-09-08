import type { MediaFormat, Project, StoryboardFrame, StoryboardMediaInfo } from "./types";

/** Relative aspect difference at or above this is a meaningful mismatch. Heuristic, not a camera spec. */
export const ASPECT_RELATIVE_TOLERANCE = 0.01;

export type MediaPreflightSeverity = "warning" | "info";
export type MediaPreflightKind = "aspect" | "resolution" | "format";

export type MediaPreflightGroup = {
  frameIds: string[];
  labels: string[];
  width: number;
  height: number;
  aspect: number;
  format: MediaFormat;
};

export type MediaPreflightFinding = {
  kind: MediaPreflightKind;
  severity: MediaPreflightSeverity;
  groups: MediaPreflightGroup[];
};

export type MediaPreflight = {
  findings: MediaPreflightFinding[];
  warningCount: number;
  infoCount: number;
};

/** Filmmaker-facing media provenance. Distinct from Plan FPO origin notes. */
export type DisplayProvenance = "uploaded" | "generated" | "derived" | "discovered";

export function displayProvenanceForFrame(frame: StoryboardFrame): DisplayProvenance | undefined {
  if (frame.imageOrigin === "user") {
    return "uploaded";
  }
  if (frame.imageOrigin === "generated") {
    return "derived";
  }
  return undefined;
}

export function provenanceAccessibleLabel(provenance: DisplayProvenance): string {
  switch (provenance) {
    case "uploaded":
      return "Uploaded frame";
    case "generated":
      return "Generated frame";
    case "derived":
      return "Derived destination";
    case "discovered":
      return "Discovered destination";
  }
}

export function aspectRatio(width: number, height: number): number {
  return width / height;
}

export function aspectsAgree(a: number, b: number, tolerance = ASPECT_RELATIVE_TOLERANCE): boolean {
  const mean = (Math.abs(a) + Math.abs(b)) / 2;
  if (mean === 0) {
    return a === b;
  }
  return Math.abs(a - b) / mean < tolerance;
}

const ASPECT_EXACT_TOLERANCE = 0.0025;
const ASPECT_NAMED_TOLERANCE = 0.02;

const NAMED_ASPECTS: readonly { label: string; value: number; conventional?: boolean }[] = [
  { label: "1:1", value: 1 },
  { label: "5:4", value: 5 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "1.85:1", value: 1.85, conventional: true },
  { label: "2:1", value: 2 },
  { label: "2.35:1", value: 2.35, conventional: true },
  { label: "2.39:1", value: 2.39, conventional: true },
  { label: "9:16", value: 9 / 16 },
];

/**
 * Filmmaker-readable aspect. Named standards may be exact or approximate ("~").
 * Conventional cinema labels such as 1.85:1 are themselves roundings, so they
 * keep "~" rather than claiming exact geometry.
 */
export function formatFriendlyAspectRatio(width: number, height: number): string {
  const actual = aspectRatio(width, height);
  let best: (typeof NAMED_ASPECTS)[number] | undefined;
  let bestError = Number.POSITIVE_INFINITY;
  for (const named of NAMED_ASPECTS) {
    const mean = (actual + named.value) / 2;
    const error = mean === 0 ? Math.abs(actual - named.value) : Math.abs(actual - named.value) / mean;
    if (error < bestError) {
      best = named;
      bestError = error;
    }
  }
  if (best && bestError < ASPECT_NAMED_TOLERANCE) {
    if (best.conventional || bestError >= ASPECT_EXACT_TOLERANCE) {
      return `~${best.label}`;
    }
    return best.label;
  }
  return `~${actual.toFixed(2)}:1`;
}

export function formatMediaInfoLine(info: StoryboardMediaInfo): string {
  return `${formatFriendlyAspectRatio(info.width, info.height)} · ${info.width}×${info.height} · ${formatMediaFormatShort(info.format)}`;
}

export function preflightAffectedFrameIds(report: MediaPreflight): string[] {
  return [...new Set(report.findings.flatMap((finding) => finding.groups.flatMap((group) => group.frameIds)))];
}

export type FramePreflightWarning = {
  kind: MediaPreflightKind;
  title: string;
  detail: string;
};

function uniqueMajorityGroup(groups: MediaPreflightGroup[]): MediaPreflightGroup | undefined {
  if (groups.length === 0) {
    return undefined;
  }
  const maxSize = Math.max(...groups.map((group) => group.frameIds.length));
  const majorities = groups.filter((group) => group.frameIds.length === maxSize);
  return majorities.length === 1 ? majorities[0] : undefined;
}

function aspectWarningForFrame(
  finding: MediaPreflightFinding,
  frameId: string,
): FramePreflightWarning | undefined {
  const mine = finding.groups.find((group) => group.frameIds.includes(frameId));
  if (!mine) {
    return undefined;
  }
  const majority = uniqueMajorityGroup(finding.groups);
  if (majority && majority.frameIds.includes(frameId)) {
    return undefined;
  }
  const index = mine.frameIds.indexOf(frameId);
  const label = mine.labels[index] ?? frameId;
  const aspect = formatFriendlyAspectRatio(mine.width, mine.height);
  const others = finding.groups
    .filter((group) => group !== mine)
    .map((group) => formatFriendlyAspectRatio(group.width, group.height));
  const otherText =
    others.length === 1 ? others[0] : others.length > 1 ? others.join(", ") : undefined;
  const detail = otherText
    ? `${label} is ${aspect} (${mine.width}×${mine.height}).\nOther storyboard frames are ${otherText}.`
    : `${label} is ${aspect} (${mine.width}×${mine.height}).`;
  return {
    kind: "aspect",
    title: "Aspect ratio differs",
    detail,
  };
}

/** Warning-level findings only. Informational resolution/format differences do not produce icons. */
export function preflightWarningsForFrame(
  report: MediaPreflight,
  frameId: string,
): FramePreflightWarning[] {
  return report.findings.flatMap((finding) => {
    if (finding.severity !== "warning" || finding.kind !== "aspect") {
      return [];
    }
    const warning = aspectWarningForFrame(finding, frameId);
    return warning ? [warning] : [];
  });
}

export function compactFrameLabels(labels: string[]): string {
  if (labels.length === 0) {
    return "";
  }
  if (labels.length === 1) {
    return labels[0] ?? "";
  }
  const sequential = labels.every((label, index) => {
    if (label.length !== 1) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const previous = labels[index - 1];
    return Boolean(previous && label.charCodeAt(0) === previous.charCodeAt(0) + 1);
  });
  if (sequential) {
    return `${labels[0]}–${labels[labels.length - 1]}`;
  }
  return labels.join(", ");
}

export function mediaFormatFromFile(file: { type: string; name?: string }): MediaFormat | undefined {
  const mime = file.type.trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") {
    return "jpeg";
  }
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  const name = file.name?.trim().toLowerCase() ?? "";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "jpeg";
  }
  if (name.endsWith(".png")) {
    return "png";
  }
  if (name.endsWith(".webp")) {
    return "webp";
  }
  return undefined;
}

export async function readStoryboardMediaInfo(file: File): Promise<StoryboardMediaInfo | undefined> {
  const format = mediaFormatFromFile(file);
  if (!format) {
    return undefined;
  }
  if (typeof createImageBitmap !== "function") {
    return undefined;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const info: StoryboardMediaInfo = { width: bitmap.width, height: bitmap.height, format };
    bitmap.close();
    return info;
  } catch {
    return undefined;
  }
}

function actualStoryboardFrames(frames: StoryboardFrame[]): (StoryboardFrame & {
  mediaInfo: StoryboardMediaInfo;
})[] {
  return frames.filter(
    (frame): frame is StoryboardFrame & { mediaInfo: StoryboardMediaInfo } =>
      Boolean(frame.image) &&
      frame.imageOrigin !== "none" &&
      frame.mediaInfo !== undefined &&
      frame.mediaInfo.width > 0 &&
      frame.mediaInfo.height > 0,
  );
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): T[][] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }
  return [...buckets.values()];
}

function toGroup(
  frames: (StoryboardFrame & { mediaInfo: StoryboardMediaInfo })[],
): MediaPreflightGroup {
  const first = frames[0]!.mediaInfo;
  return {
    frameIds: frames.map((frame) => frame.id),
    labels: frames.map((frame) => frame.label),
    width: first.width,
    height: first.height,
    aspect: aspectRatio(first.width, first.height),
    format: first.format,
  };
}

function aspectClusters(
  frames: (StoryboardFrame & { mediaInfo: StoryboardMediaInfo })[],
): MediaPreflightGroup[] {
  const clusters: (StoryboardFrame & { mediaInfo: StoryboardMediaInfo })[][] = [];
  for (const frame of frames) {
    const aspect = aspectRatio(frame.mediaInfo.width, frame.mediaInfo.height);
    const existing = clusters.find((cluster) => {
      const sample = cluster[0]!.mediaInfo;
      return aspectsAgree(aspect, aspectRatio(sample.width, sample.height));
    });
    if (existing) {
      existing.push(frame);
    } else {
      clusters.push([frame]);
    }
  }
  return clusters.map(toGroup);
}

export function mediaPreflightForProject(project: Project): MediaPreflight {
  const frames = actualStoryboardFrames(project.storyboard);
  if (frames.length < 2) {
    return { findings: [], warningCount: 0, infoCount: 0 };
  }

  const findings: MediaPreflightFinding[] = [];
  const aspectGroups = aspectClusters(frames);
  if (aspectGroups.length > 1) {
    findings.push({ kind: "aspect", severity: "warning", groups: aspectGroups });
  }

  const resolutionGroups = groupBy(
    frames,
    (frame) => `${frame.mediaInfo.width}x${frame.mediaInfo.height}`,
  ).map(toGroup);
  if (resolutionGroups.length > 1) {
    findings.push({ kind: "resolution", severity: "info", groups: resolutionGroups });
  }

  const formatGroups = groupBy(frames, (frame) => frame.mediaInfo.format).map(toGroup);
  if (formatGroups.length > 1) {
    findings.push({ kind: "format", severity: "info", groups: formatGroups });
  }

  return {
    findings,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    infoCount: findings.filter((finding) => finding.severity === "info").length,
  };
}

export function formatMediaFormat(format: MediaFormat): string {
  return formatMediaFormatShort(format);
}

export function formatMediaFormatShort(format: MediaFormat): string {
  switch (format) {
    case "jpeg":
      return "JPG";
    case "png":
      return "PNG";
    case "webp":
      return "WebP";
  }
}
