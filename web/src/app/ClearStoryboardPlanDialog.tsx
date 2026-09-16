import { useCallback, useEffect, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import {
  CLEAR_STORYBOARD_PLAN_CLEAR_LABEL,
  CLEAR_STORYBOARD_PLAN_KEEP_LABEL,
  CLEAR_STORYBOARD_PLAN_ON_UPLOAD_PROMPT,
  shouldAskToClearStoryboardPlanOnUpload,
} from "../project/starting-frame";

export function ClearStoryboardPlanDialog({
  onKeep,
  onClear,
}: {
  onKeep: () => void;
  onClear: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onKeep();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeep]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="clear-storyboard-plan-title"
      aria-describedby="clear-storyboard-plan-copy"
      onClick={onKeep}
    >
      <div
        className="w-full max-w-md rounded border border-[#3a342c] bg-[#141210] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          id="clear-storyboard-plan-title"
          className="text-[11px] tracking-[0.16em] text-[#9a8f7e] uppercase"
        >
          Destination plan
        </p>
        <p id="clear-storyboard-plan-copy" className="mt-2 text-sm leading-6 text-[#ece7df]">
          {CLEAR_STORYBOARD_PLAN_ON_UPLOAD_PROMPT}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-[#3a342c] px-3 py-1.5 text-[11px] tracking-[0.14em] text-[#9a8f7e] uppercase outline-none hover:border-[#7a7266] hover:text-[#ece7df] focus-visible:ring-1 focus-visible:ring-[#7a7266]"
            onClick={onKeep}
            autoFocus
          >
            {CLEAR_STORYBOARD_PLAN_KEEP_LABEL}
          </button>
          <button
            type="button"
            className="rounded border border-[#ece7df] bg-[#ece7df] px-3 py-1.5 text-[11px] tracking-[0.14em] text-[#141210] uppercase outline-none hover:bg-[#fff] focus-visible:ring-1 focus-visible:ring-[#d4b36a]"
            onClick={onClear}
          >
            {CLEAR_STORYBOARD_PLAN_CLEAR_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useReplaceDestinationImage() {
  const { project, replaceDestinationImage } = useProject();
  const [pending, setPending] = useState<{ frameId: string; file: File } | null>(null);

  const applyDestinationImageFile = useCallback(
    (frameId: string, file: File) => {
      const frame = project.storyboard.find((item) => item.id === frameId);
      if (frame && shouldAskToClearStoryboardPlanOnUpload(frame)) {
        setPending({ frameId, file });
        return;
      }
      void replaceDestinationImage(frameId, file, { clearPlan: false });
    },
    [project.storyboard, replaceDestinationImage],
  );

  const resolvePending = useCallback(
    (clearPlan: boolean) => {
      if (!pending) {
        return;
      }
      const { frameId, file } = pending;
      setPending(null);
      void replaceDestinationImage(frameId, file, { clearPlan });
    },
    [pending, replaceDestinationImage],
  );

  const dialog = pending ? (
    <ClearStoryboardPlanDialog
      onKeep={() => resolvePending(false)}
      onClear={() => resolvePending(true)}
    />
  ) : null;

  return { applyDestinationImageFile, dialog };
}
