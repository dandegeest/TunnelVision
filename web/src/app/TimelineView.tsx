import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useProject } from "../project/ProjectProvider";
import { Inspector, InspectorToggle } from "./Inspector";
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
  const { inspectorOpen } = useProject();
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
      className="grid h-full min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns: inspectorOpen ? "minmax(0,1fr) 320px" : "minmax(0,1fr) 2rem",
        gridTemplateRows: `minmax(${PREVIEW_MIN}px, 1fr) ${SEPARATOR_PX}px ${timelineHeight}px`,
      }}
    >
      <div className="min-h-0 overflow-hidden" style={{ gridColumn: 1, gridRow: 1 }}>
        <Preview />
      </div>
      <div
        className="min-h-0 overflow-hidden"
        {...(inspectorOpen ? {} : { hidden: true })}
        style={inspectorOpen ? { gridColumn: 2, gridRow: 1 } : undefined}
      >
        <Inspector />
      </div>
      {inspectorOpen ? null : (
        <div
          className="inspector-reopen flex h-full flex-col items-center border-l border-[#2a2620]"
          style={{ gridColumn: 2, gridRow: "1 / span 3" }}
        >
          <div className="flex h-9 w-full items-center justify-center">
            <InspectorToggle compact />
          </div>
        </div>
      )}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        aria-valuemin={TIMELINE_HEIGHT_MIN}
        aria-valuemax={Math.max(TIMELINE_HEIGHT_MIN, 800 - PREVIEW_MIN - SEPARATOR_PX)}
        aria-valuenow={timelineHeight}
        tabIndex={0}
        className="cursor-row-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
        style={{ gridColumn: inspectorOpen ? "1 / -1" : 1, gridRow: 2 }}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={onResizeKeyDown}
      />
      <div
        className="min-h-0 overflow-hidden"
        style={{
          gridColumn: inspectorOpen ? "1 / -1" : 1,
          gridRow: 3,
        }}
      >
        <Timeline />
      </div>
    </div>
  );
}
