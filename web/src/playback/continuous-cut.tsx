import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useProject } from "../project/ProjectProvider";
import { layoutShootTimeline } from "../timeline/shoot-layout";
import {
  buildContinuousPreview,
  continuousPreviewClips,
  type ContinuousPreviewClip,
  type ContinuousPreviewMediaSpan,
} from "./remux";
import type { CutSpan } from "./time-map";

export type ContinuousCutStatus = "idle" | "building" | "ready" | "error";

export type ContinuousCutValue = {
  status: ContinuousCutStatus;
  url: string | null;
  error: string | null;
  spans: CutSpan[];
  outputDuration: number;
};

const EMPTY: ContinuousCutValue = {
  status: "idle",
  url: null,
  error: null,
  spans: [],
  outputDuration: 0,
};

const ContinuousCutContext = createContext<ContinuousCutValue>(EMPTY);

function previewBuildAborted(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function continuousCutKey(clips: readonly ContinuousPreviewClip[]): string {
  return clips
    .map((clip) => `${clip.journeyId}\t${clip.takeId}\t${clip.url}\t${clip.dropFirstFrame ? 1 : 0}`)
    .join("\n");
}

function alignSpans(project: Parameters<typeof layoutShootTimeline>[0], media: readonly ContinuousPreviewMediaSpan[]): CutSpan[] {
  const layout = layoutShootTimeline(project, 1);
  return media.map((span) => {
    const laid = layout.journeys.find((item) => item.journeyId === span.journeyId);
    return {
      journeyId: span.journeyId,
      mediaStart: span.mediaStart,
      mediaEnd: span.mediaEnd,
      timelineStart: laid?.startTime ?? span.mediaStart,
      timelineEnd: laid?.endTime ?? span.mediaEnd,
    };
  });
}

/**
 * Keeps one remuxed preview of the selected takes. Rebuilds when that selection changes.
 * Download/export stays on the server assembly.
 */
export function ContinuousCutBridge({ children }: { children: ReactNode }) {
  const { project } = useProject();
  const clips = useMemo(() => continuousPreviewClips(project), [project]);
  const key = useMemo(() => continuousCutKey(clips), [clips]);
  const [status, setStatus] = useState<ContinuousCutStatus>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaSpans, setMediaSpans] = useState<ContinuousPreviewMediaSpan[]>([]);
  const [outputDuration, setOutputDuration] = useState(0);
  const urlRef = useRef<string | null>(null);
  const clipsRef = useRef(clips);
  clipsRef.current = clips;

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (clips.length === 0) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setUrl(null);
      setMediaSpans([]);
      setOutputDuration(0);
      setError(null);
      setStatus("idle");
      return;
    }

    const requested = clipsRef.current;
    const controller = new AbortController();
    let cancelled = false;
    // Defer past StrictMode's setup/cleanup/setup so the discarded run never
    // starts a second remux. A real selection change aborts the in-flight build.
    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setStatus("building");
      setError(null);
      void buildContinuousPreview(requested, controller.signal)
        .then((built) => {
          if (cancelled) {
            return;
          }
          console.info("[continuous-preview]", built.report);
          if (!built.buffer || !built.report.ok) {
            if (urlRef.current) {
              URL.revokeObjectURL(urlRef.current);
              urlRef.current = null;
            }
            setUrl(null);
            setMediaSpans([]);
            setOutputDuration(0);
            setError(built.report.error ?? "Could not assemble the preview.");
            setStatus("error");
            return;
          }
          const nextUrl = URL.createObjectURL(new Blob([built.buffer], { type: "video/mp4" }));
          if (cancelled) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
          }
          urlRef.current = nextUrl;
          setMediaSpans(built.spans);
          setOutputDuration(built.report.outputDurationSeconds);
          setUrl(nextUrl);
          setStatus("ready");
        })
        .catch((failure: unknown) => {
          if (cancelled || previewBuildAborted(failure)) {
            return;
          }
          setError(failure instanceof Error ? failure.message : "Could not assemble the preview.");
          setStatus("error");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  const spans = useMemo(() => alignSpans(project, mediaSpans), [project, mediaSpans]);
  const value = useMemo<ContinuousCutValue>(
    () => ({ status, url, error, spans, outputDuration }),
    [status, url, error, spans, outputDuration],
  );

  return <ContinuousCutContext.Provider value={value}>{children}</ContinuousCutContext.Provider>;
}

export function useContinuousCut(): ContinuousCutValue {
  return useContext(ContinuousCutContext);
}
