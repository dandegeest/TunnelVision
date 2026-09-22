import { useEffect, useRef, useState, type ReactNode } from "react";
import { selectedCanonicalTake } from "../../project/canonical-takes";
import { cinematographerScoreTone } from "../../project/cinematographer";
import type { StoryboardFrame } from "../../project/types";
import { StoryboardFrameMedia } from "../PlanView";
import type { JourneyProgress, JourneyProgressStatus } from "../conversation-console";
import { previousCanonicals, rejectedCanonicals, type RejectedCanonical } from "./journey-turns";

/** Journeys shorter than this scale to the chat width instead of scrolling. */
export const AGENT_PATH_FIT_LIMIT = 10;

function PathLine({
  from,
  to,
  status,
}: {
  from: string;
  to: string;
  status: JourneyProgressStatus;
}) {
  return (
    <span
      aria-label={`Footage ${from} to ${to} ${status === "complete" ? "complete" : status === "active" ? "in progress" : "pending"}`}
      data-progress-line={status}
      className={`h-1 w-5 shrink-0 ${
        status === "active"
          ? "journey-progress-line-active"
          : status === "complete"
            ? "bg-[#8fa36a]"
            : "journey-progress-line-pending"
      }`}
    />
  );
}

function NodeCaption({
  caption,
  beat,
  selected,
}: {
  caption: string;
  beat?: string;
  selected: boolean;
}) {
  const detail = selected ? beat?.trim() : "";
  return (
    <>
      <p className="mt-2 truncate text-[12px] tracking-[0.12em] text-[#9a8f7e]">{caption}</p>
      {detail && detail !== caption ? (
        <p className="mt-1.5 text-[12px] leading-snug text-[#cfc6b8]">{detail}</p>
      ) : null}
    </>
  );
}

function GeneratingFpo({
  letter,
  selected,
  onSelect,
}: {
  letter: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Reshoot ${letter} generating`}
      aria-pressed={selected}
      aria-busy="true"
      onClick={onSelect}
      className={`relative block aspect-video w-full overflow-hidden ${
        selected ? "border border-[#ece7df]" : "border border-[#2a2620]"
      }`}
    >
      <span className="storyboard-fpo storyboard-generating absolute inset-0" />
    </button>
  );
}

function ReshootHistory({
  count,
  defaultOpen = false,
  children,
}: {
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = count === 1 ? "1 reshoot" : `${count} reshoots`;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center text-[12px] tracking-[0.04em] text-[#7a7266] outline-none hover:text-[#ece7df] focus-visible:text-[#ece7df]"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="ml-1.5" aria-hidden>
          {open ? "▾" : "›"}
        </span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col items-start">
          <span className="ml-4 h-3 w-px bg-[#3a342c]" aria-hidden />
          <div className="w-full max-w-[9rem] space-y-2">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function FailedTake({ reject }: { reject: RejectedCanonical }) {
  const frame: StoryboardFrame = {
    id: reject.take.id,
    label: `${reject.letter} · ${reject.attempt}`,
    image: reject.take.imageUrl,
    imageOrigin: reject.take.origin,
    mediaId: reject.take.mediaId,
  };
  return (
    <div className="w-full opacity-40">
      <StoryboardFrameMedia frame={frame} selected={false} constructing={false} />
      <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] tracking-[0.04em] text-[#9a8f7e]">
        <span>Failed</span>
        {reject.travel != null ? (
          <span className="flex items-center gap-1.5">
            <span>Travel</span>
            <span className={cinematographerScoreTone(reject.travel, true)}>{reject.travel}</span>
          </span>
        ) : null}
      </p>
    </div>
  );
}

function LetterNode({
  letter,
  status,
  selected,
  onSelect,
}: {
  letter: string;
  status: JourneyProgressStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex aspect-video w-full items-center justify-center">
      <button
        type="button"
        aria-label={`Canonical ${letter} ${status === "active" ? "in progress" : "pending"}`}
        aria-pressed={selected}
        onClick={onSelect}
        className={`inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-[#7a7266] bg-transparent px-2 text-[12px] font-semibold tracking-[0.06em] text-[#cfc6b8] outline-none hover:border-[#ece7df] hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#ece7df] ${
          status === "active" ? "animate-pulse ring-1 ring-[#ece7df]" : selected ? "ring-1 ring-[#ece7df]" : ""
        }`}
      >
        {letter}
      </button>
    </div>
  );
}

function PathStop({
  id,
  media,
  caption,
  extra,
  connector,
}: {
  id: string;
  media: ReactNode;
  caption: ReactNode;
  extra?: ReactNode;
  connector: ReactNode;
}) {
  return (
    <li data-stop={id} className="flex shrink-0 items-start">
      <div className="w-[10.5rem] max-w-[10.5rem]">
        {media}
        {caption}
        {extra}
      </div>
      {connector ? (
        <div className="flex aspect-video w-5 shrink-0 items-center justify-center">
          {connector}
        </div>
      ) : null}
    </li>
  );
}

function JourneyPathTrack({
  stopCount,
  followId,
  label,
  children,
}: {
  stopCount: number;
  followId?: string;
  label?: string;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const fit = stopCount < AGENT_PATH_FIT_LIMIT;
  const showChevrons = !fit || overflowing;

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setOverflowing(node.scrollWidth - node.clientWidth > 2);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stopCount]);

  useEffect(() => {
    if (!followId) {
      return;
    }
    const node = scrollerRef.current?.querySelector(`[data-stop="${followId}"]`);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [followId]);

  const scroll = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    node.scrollBy({ left: direction * Math.max(160, node.clientWidth * 0.45), behavior: "smooth" });
  };

  return (
    <div className="relative min-w-0" data-path-fit={fit ? "pack" : "scroll"}>
      {showChevrons ? (
        <>
          <button
            type="button"
            aria-label="Previous locations"
            className="absolute left-0 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#161410]/90 text-[18px] text-[#ece7df] outline-none hover:text-white"
            onClick={() => scroll(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next locations"
            className="absolute right-0 top-8 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#161410]/90 text-[18px] text-[#ece7df] outline-none hover:text-white"
            onClick={() => scroll(1)}
          >
            ›
          </button>
        </>
      ) : null}
      <div
        ref={scrollerRef}
        className={`agent-scroll min-w-0 overscroll-x-contain ${
          showChevrons ? "overflow-x-auto px-9" : "overflow-x-hidden"
        }`}
      >
        <ol aria-label={label} className="flex w-max items-start gap-0">
          {children}
        </ol>
      </div>
    </div>
  );
}

export function AgentJourneyPath({
  frames,
  progress,
  captions,
  beats,
  selectedId,
  constructingId,
  repairingId,
  repairTravel,
  onSelect,
  onOpenReel,
}: {
  frames: StoryboardFrame[];
  progress: JourneyProgress;
  captions: Record<string, string>;
  beats?: Record<string, string>;
  selectedId?: string;
  constructingId?: string | null;
  repairingId?: string | null;
  repairTravel?: number;
  onSelect: (id: string) => void;
  onOpenReel?: (id: string) => void;
}) {
  const frameById = new Map(frames.map((frame) => [frame.id, frame]));
  const followId = constructingId ?? repairingId ?? progress.nodes.find((node) => node.status === "active")?.id;
  return (
    <JourneyPathTrack stopCount={progress.nodes.length} followId={followId} label="Journey path">
      {progress.nodes.map((node, index) => {
        const frame = frameById.get(node.id);
        const next = progress.nodes[index + 1];
        const segment = progress.segments[index];
        const generating = constructingId === node.id || repairingId === node.id;
        const rejects = frame
          ? generating
            ? previousCanonicals(frame, repairTravel)
            : rejectedCanonicals(frame, repairTravel)
          : [];
        const selectedTake = frame ? selectedCanonicalTake(frame) : undefined;
        const displayFrame =
          frame && selectedTake
            ? { ...frame, image: selectedTake.imageUrl ?? frame.image, mediaId: selectedTake.mediaId }
            : frame;
        const historyOpen = Boolean(repairingId === node.id);
        const showStill = Boolean(!generating && displayFrame?.image);
        const selected = selectedId === node.id;
        const caption = captions[node.id] ?? node.caption ?? node.letter;
        const beat = beats?.[node.id];
        const media = showStill || generating ? (
          generating ? (
            <GeneratingFpo
              letter={node.letter}
              selected={selected}
              onSelect={() => {
                if (selected && onOpenReel) {
                  onOpenReel(node.id);
                  return;
                }
                onSelect(node.id);
              }}
            />
          ) : displayFrame ? (
            <StoryboardFrameMedia
              frame={displayFrame}
              selected={selected}
              constructing={false}
              onSelect={() => onSelect(node.id)}
              onOpenReel={onOpenReel ? () => onOpenReel(node.id) : undefined}
            />
          ) : null
        ) : (
          <LetterNode
            letter={node.letter}
            status={node.status}
            selected={selected}
            onSelect={() => {
              if (selected && onOpenReel) {
                onOpenReel(node.id);
                return;
              }
              onSelect(node.id);
            }}
          />
        );
        return (
          <PathStop
            key={node.id}
            id={node.id}
            media={media}
            caption={<NodeCaption caption={caption} beat={beat} selected={selected} />}
            extra={
              rejects.length > 0 ? (
                <ReshootHistory count={rejects.length} defaultOpen={historyOpen}>
                  {rejects.map((reject) => (
                    <FailedTake key={reject.take.id} reject={reject} />
                  ))}
                </ReshootHistory>
              ) : null
            }
            connector={next && segment ? <PathLine from={node.id} to={next.id} status={segment.status} /> : null}
          />
        );
      })}
    </JourneyPathTrack>
  );
}

export function AgentCollapsedStrip({
  frames,
  selectedId,
  onSelect,
  onOpenReel,
}: {
  frames: StoryboardFrame[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenReel?: (id: string) => void;
}) {
  if (frames.length === 0) {
    return null;
  }
  const fit = frames.length < AGENT_PATH_FIT_LIMIT;
  return (
    <ol
      className={`mt-2 flex w-max items-center ${fit ? "" : "agent-scroll overflow-x-auto"}`}
      aria-label="Journey stills"
      data-collapsed-path
    >
      {frames.map((frame, index) => {
        const next = frames[index + 1];
        return (
          <li key={frame.id} className="flex shrink-0 items-center">
            <div className="w-[3.5rem]">
              <StoryboardFrameMedia
                frame={frame}
                selected={selectedId === frame.id}
                constructing={false}
                onSelect={() => onSelect(frame.id)}
                onOpenReel={onOpenReel ? () => onOpenReel(frame.id) : undefined}
              />
            </div>
            {next ? <span className="mx-1 h-px w-3 shrink-0 bg-[#3a342c]" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function AgentCompletedStrip({
  frames,
  captions,
  beats,
  selectedId,
  onSelect,
  onOpenReel,
}: {
  frames: StoryboardFrame[];
  captions: Record<string, string>;
  beats?: Record<string, string>;
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenReel?: (id: string) => void;
}) {
  return (
    <JourneyPathTrack stopCount={frames.length} label="Journey path">
      {frames.map((frame, index) => {
        const next = frames[index + 1];
        const selected = selectedId === frame.id;
        return (
          <PathStop
            key={frame.id}
            id={frame.id}
            media={
              <StoryboardFrameMedia
                frame={frame}
                selected={selected}
                constructing={false}
                onSelect={() => onSelect(frame.id)}
                onOpenReel={onOpenReel ? () => onOpenReel(frame.id) : undefined}
              />
            }
            caption={
              <NodeCaption
                caption={captions[frame.id] ?? frame.label}
                beat={beats?.[frame.id]}
                selected={selected}
              />
            }
            connector={next ? <PathLine from={frame.id} to={next.id} status="complete" /> : null}
          />
        );
      })}
    </JourneyPathTrack>
  );
}
