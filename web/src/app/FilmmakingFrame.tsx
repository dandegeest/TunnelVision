import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useProject } from "../project/ProjectProvider";
import { ConversationRail, ConversationRailToggle } from "./ConversationRail";

const STORY_WIDTH_DEFAULT = 328;
const STORY_WIDTH_MIN = 260;
const STORY_WIDTH_MAX = 480;
const STORYBOARD_MIN = 420;

function clampStoryWidth(width: number, containerWidth: number) {
  const max = Math.max(
    STORY_WIDTH_MIN,
    Math.min(STORY_WIDTH_MAX, containerWidth - STORYBOARD_MIN),
  );
  return Math.min(max, Math.max(STORY_WIDTH_MIN, width));
}

export function FilmmakingFrame({
  brand,
  workspaceHeader,
  children,
}: {
  brand?: ReactNode;
  workspaceHeader?: ReactNode;
  children: ReactNode;
}) {
  const { conversationRailOpen } = useProject();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [storyWidth, setStoryWidth] = useState(STORY_WIDTH_DEFAULT);
  const hasChrome = Boolean(brand || workspaceHeader);
  const open = conversationRailOpen;
  const bodyRow = hasChrome ? 2 : 1;

  const containerWidth = () => frameRef.current?.getBoundingClientRect().width ?? 1200;

  const onResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: storyWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [storyWidth]);

  const onResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    setStoryWidth(clampStoryWidth(drag.startWidth + event.clientX - drag.startX, containerWidth()));
  }, []);

  const onResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setStoryWidth((width) => clampStoryWidth(width - step, containerWidth()));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setStoryWidth((width) => clampStoryWidth(width + step, containerWidth()));
    }
  }, []);

  return (
    <div
      ref={frameRef}
      className="grid h-full min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns: open ? `${storyWidth}px 0.375rem minmax(0, 1fr)` : "2rem minmax(0, 1fr)",
        gridTemplateRows: hasChrome ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
      }}
    >
      {hasChrome && open ? (
        <div className="min-w-0" style={{ gridColumn: 1, gridRow: 1 }}>
          {brand}
        </div>
      ) : null}
      {open ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize story panel"
          aria-valuemin={STORY_WIDTH_MIN}
          aria-valuemax={STORY_WIDTH_MAX}
          aria-valuenow={storyWidth}
          tabIndex={0}
          className="h-full cursor-col-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
          style={{ gridColumn: 2, gridRow: hasChrome ? "1 / span 2" : 1 }}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          onKeyDown={onResizeKeyDown}
        />
      ) : null}
      {hasChrome ? (
        <div className="min-w-0" style={{ gridColumn: open ? 3 : "1 / span 2", gridRow: 1 }}>
          {workspaceHeader}
        </div>
      ) : null}
      <div
        className="h-full min-h-0 min-w-0"
        {...(open ? {} : { hidden: true })}
        style={open ? { gridColumn: 1, gridRow: bodyRow } : undefined}
      >
        <ConversationRail />
      </div>
      {open ? null : (
        <div
          className="conversation-rail-reopen flex h-9 items-center justify-center border-r border-[#2a2620]"
          style={{ gridColumn: 1, gridRow: bodyRow }}
        >
          <ConversationRailToggle compact />
        </div>
      )}
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ gridColumn: open ? 3 : 2, gridRow: bodyRow }}
      >
        {children}
      </div>
    </div>
  );
}
