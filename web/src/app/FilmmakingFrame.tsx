import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useProject } from "../project/ProjectProvider";
import { ConversationRail, ConversationRailToggle } from "./ConversationRail";
import { ProjectRail, ProjectRailToggle } from "./ProjectRail";

const RAIL_WIDTH_DEFAULT = 328;
const RAIL_WIDTH_MIN = 260;
const RAIL_WIDTH_MAX = 480;
const STORYBOARD_MIN = 420;
const SEPARATOR_PX = 6;
const COLLAPSED_PX = 32;

function occupiedWidth(open: boolean, width: number) {
  return open ? width + SEPARATOR_PX : COLLAPSED_PX;
}

function clampRailWidth(width: number, containerWidth: number, otherOccupied: number) {
  const max = Math.max(
    RAIL_WIDTH_MIN,
    Math.min(RAIL_WIDTH_MAX, containerWidth - STORYBOARD_MIN - otherOccupied),
  );
  return Math.min(max, Math.max(RAIL_WIDTH_MIN, width));
}

function railLayout(
  conversationOpen: boolean,
  projectOpen: boolean,
  conversationWidth: number,
  projectWidth: number,
) {
  if (conversationOpen && projectOpen) {
    return {
      columns: `${conversationWidth}px 0.375rem minmax(0, 1fr) 0.375rem ${projectWidth}px`,
      conversation: 1,
      conversationResize: 2,
      main: 3,
      projectResize: 4,
      project: 5,
    };
  }
  if (conversationOpen) {
    return {
      columns: `${conversationWidth}px 0.375rem minmax(0, 1fr) 2rem`,
      conversation: 1,
      conversationResize: 2,
      main: 3,
      projectResize: null,
      project: 4,
    };
  }
  if (projectOpen) {
    return {
      columns: `2rem minmax(0, 1fr) 0.375rem ${projectWidth}px`,
      conversation: 1,
      conversationResize: null,
      main: 2,
      projectResize: 3,
      project: 4,
    };
  }
  return {
    columns: "2rem minmax(0, 1fr) 2rem",
    conversation: 1,
    conversationResize: null,
    main: 2,
    projectResize: null,
    project: 3,
  };
}

export function FilmmakingFrame({
  brand,
  workspaceHeader,
  projectHeader,
  children,
}: {
  brand?: ReactNode;
  workspaceHeader?: ReactNode;
  projectHeader?: ReactNode;
  children: ReactNode;
}) {
  const { conversationRailOpen, projectRailOpen } = useProject();
  const frameRef = useRef<HTMLDivElement>(null);
  const conversationDrag = useRef<{ startX: number; startWidth: number } | null>(null);
  const projectDrag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [conversationWidth, setConversationWidth] = useState(RAIL_WIDTH_DEFAULT);
  const [projectWidth, setProjectWidth] = useState(RAIL_WIDTH_DEFAULT);
  const hasChrome = Boolean(brand || workspaceHeader || projectHeader);
  const layout = railLayout(conversationRailOpen, projectRailOpen, conversationWidth, projectWidth);
  const bodyRow = hasChrome ? 2 : 1;

  const containerWidth = () => frameRef.current?.getBoundingClientRect().width ?? 1200;

  const onConversationResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    conversationDrag.current = { startX: event.clientX, startWidth: conversationWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [conversationWidth]);

  const onConversationResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = conversationDrag.current;
    if (!drag) {
      return;
    }
    setConversationWidth(
      clampRailWidth(
        drag.startWidth + event.clientX - drag.startX,
        containerWidth(),
        occupiedWidth(projectRailOpen, projectWidth),
      ),
    );
  }, [projectRailOpen, projectWidth]);

  const onConversationResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    conversationDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onConversationResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setConversationWidth((width) =>
        clampRailWidth(width - step, containerWidth(), occupiedWidth(projectRailOpen, projectWidth)),
      );
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setConversationWidth((width) =>
        clampRailWidth(width + step, containerWidth(), occupiedWidth(projectRailOpen, projectWidth)),
      );
    }
  }, [projectRailOpen, projectWidth]);

  const onProjectResizePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    projectDrag.current = { startX: event.clientX, startWidth: projectWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [projectWidth]);

  const onProjectResizePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = projectDrag.current;
    if (!drag) {
      return;
    }
    setProjectWidth(
      clampRailWidth(
        drag.startWidth - (event.clientX - drag.startX),
        containerWidth(),
        occupiedWidth(conversationRailOpen, conversationWidth),
      ),
    );
  }, [conversationRailOpen, conversationWidth]);

  const onProjectResizePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    projectDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onProjectResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setProjectWidth((width) =>
        clampRailWidth(width + step, containerWidth(), occupiedWidth(conversationRailOpen, conversationWidth)),
      );
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setProjectWidth((width) =>
        clampRailWidth(width - step, containerWidth(), occupiedWidth(conversationRailOpen, conversationWidth)),
      );
    }
  }, [conversationRailOpen, conversationWidth]);

  return (
    <div
      ref={frameRef}
      className="grid h-full min-h-0 overflow-hidden"
      style={{
        gridTemplateColumns: layout.columns,
        gridTemplateRows: hasChrome ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
      }}
    >
      {hasChrome && conversationRailOpen ? (
        <div className="min-w-0" style={{ gridColumn: layout.conversation, gridRow: 1 }}>
          {brand}
        </div>
      ) : null}
      {layout.conversationResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize story panel"
          aria-valuemin={RAIL_WIDTH_MIN}
          aria-valuemax={RAIL_WIDTH_MAX}
          aria-valuenow={conversationWidth}
          tabIndex={0}
          className="h-full cursor-col-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
          style={{ gridColumn: layout.conversationResize, gridRow: hasChrome ? "1 / span 2" : 1 }}
          onPointerDown={onConversationResizePointerDown}
          onPointerMove={onConversationResizePointerMove}
          onPointerUp={onConversationResizePointerUp}
          onPointerCancel={onConversationResizePointerUp}
          onKeyDown={onConversationResizeKeyDown}
        />
      ) : null}
      {hasChrome ? (
        <div className="min-w-0" style={{ gridColumn: layout.main, gridRow: 1 }}>
          {workspaceHeader}
        </div>
      ) : null}
      {hasChrome && projectRailOpen ? (
        <div className="min-w-0" style={{ gridColumn: layout.project, gridRow: 1 }}>
          {projectHeader}
        </div>
      ) : null}
      {layout.projectResize ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize project panel"
          aria-valuemin={RAIL_WIDTH_MIN}
          aria-valuemax={RAIL_WIDTH_MAX}
          aria-valuenow={projectWidth}
          tabIndex={0}
          className="h-full cursor-col-resize touch-none bg-[#2a2620] hover:bg-[#3a342c] focus:bg-[#ece7df] focus:outline-none"
          style={{ gridColumn: layout.projectResize, gridRow: hasChrome ? "1 / span 2" : 1 }}
          onPointerDown={onProjectResizePointerDown}
          onPointerMove={onProjectResizePointerMove}
          onPointerUp={onProjectResizePointerUp}
          onPointerCancel={onProjectResizePointerUp}
          onKeyDown={onProjectResizeKeyDown}
        />
      ) : null}
      <div
        className="h-full min-h-0 min-w-0"
        {...(conversationRailOpen ? {} : { hidden: true })}
        style={conversationRailOpen ? { gridColumn: layout.conversation, gridRow: bodyRow } : undefined}
      >
        <ConversationRail />
      </div>
      {conversationRailOpen ? null : (
        <div
          className="conversation-rail-reopen flex h-9 items-center justify-center border-r border-[#2a2620]"
          style={{ gridColumn: layout.conversation, gridRow: bodyRow }}
        >
          <ConversationRailToggle compact />
        </div>
      )}
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ gridColumn: layout.main, gridRow: bodyRow }}
      >
        {children}
      </div>
      <div
        className="h-full min-h-0 min-w-0"
        {...(projectRailOpen ? {} : { hidden: true })}
        style={projectRailOpen ? { gridColumn: layout.project, gridRow: bodyRow } : undefined}
      >
        <ProjectRail />
      </div>
      {projectRailOpen ? null : (
        <div
          className="project-rail-reopen flex h-9 items-center justify-center border-l border-[#2a2620]"
          style={{ gridColumn: layout.project, gridRow: bodyRow }}
        >
          <ProjectRailToggle compact />
        </div>
      )}
    </div>
  );
}
