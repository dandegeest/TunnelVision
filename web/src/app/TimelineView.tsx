import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Inspector } from "./Inspector";
import { Preview } from "./Preview";
import { Timeline } from "../timeline/Timeline";

const TIMELINE_HEIGHT_DEFAULT = 360;
const TIMELINE_HEIGHT_MIN = 240;
const PREVIEW_MIN = 180;
const SEPARATOR_PX = 6;

function clampTimelineHeight(height: number, containerHeight: number) {
  const max = Math.max(
    TIMELINE_HEIGHT_MIN,
    containerHeight - PREVIEW_MIN - SEPARATOR_PX,
  );
  return Math.min(max, Math.max(TIMELINE_HEIGHT_MIN, height));
}

export function TimelineView() {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_HEIGHT_DEFAULT);

  const containerHeight = () => frameRef.current?.getBoundingClientRect().height ?? 800;

  const onResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    drag.current = { startY: event.clientY, startHeight: timelineHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [timelineHeight]);

  const onResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) {
      return;
    }
    setTimelineHeight(
      clampTimelineHeight(current.startHeight - (event.clientY - current.startY), containerHeight()),
    );
  }, []);

  const onResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setTimelineHeight((height) => clampTimelineHeight(height + step, containerHeight()));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setTimelineHeight((height) => clampTimelineHeight(height - step, containerHeight()));
    }
  }, []);

  return (
    <div
      ref={frameRef}
      className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden"
      style={{
        gridTemplateRows: `minmax(${PREVIEW_MIN}px, 1fr) ${SEPARATOR_PX}px ${timelineHeight}px`,
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <Preview />
      </div>
      <Inspector />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        aria-valuemin={TIMELINE_HEIGHT_MIN}
        aria-valuemax={Math.max(TIMELINE_HEIGHT_MIN, 800 - PREVIEW_MIN - SEPARATOR_PX)}
        aria-valuenow={timelineHeight}
        tabIndex={0}
        className="col-span-2 cursor-row-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={onResizeKeyDown}
      />
      <div className="col-span-2 min-h-0 overflow-hidden">
        <Timeline />
      </div>
    </div>
  );
}
