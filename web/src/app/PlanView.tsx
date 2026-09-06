import { useProject } from "../project/ProjectProvider";

export function PlanView() {
  const { project, selection, select } = useProject();
  const selectedId = selection.kind === "storyboard" ? selection.frameId : project.storyboard[0]?.id;

  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r border-[#2a2620] bg-[#12100d]">
        <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
          <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Conversation</p>
          <div className="mt-3">
            <p className="text-[10px] font-medium tracking-[0.16em] text-[#9a8f7e] uppercase">You</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#cfc6b8]">{project.story}</p>
          </div>
        </div>
        <div className="flex-none border-t border-[#2a2620] px-3 py-3">
          <label className="sr-only" htmlFor="plan-composer">
            Tell TunnelVision what to change
          </label>
          <div className="flex items-end gap-2 rounded border border-[#3a342c] bg-[#161410] px-2 py-2">
            <textarea
              id="plan-composer"
              disabled
              rows={2}
              placeholder="Tell TunnelVision what to change…"
              className="min-h-[2.5rem] flex-1 resize-none bg-transparent text-sm leading-snug text-[#ece7df] placeholder:text-[#9a8f7e] disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              aria-label="Send"
              title="Conversation is not connected in this slice."
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#3a342c] text-[#9a8f7e] disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <path
                  d="M2 6h8M6.5 2.5 10 6 6.5 9.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <section className="min-h-0 overflow-auto px-6 py-5">
        <p className="text-[11px] tracking-[0.22em] text-[#9a8f7e] uppercase">Storyboard</p>
        <ol className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-x-5 gap-y-7">
          {project.storyboard.map((frame) => {
            const selectedCard = frame.id === selectedId;
            const frameBorder = selectedCard
              ? "border-2 border-[#ece7df]"
              : "border-2 border-[#3a342c]";
            return (
              <li key={frame.id} className="min-w-0">
                <button
                  type="button"
                  className={`w-full text-left outline-none ${selectedCard ? "" : "opacity-90"}`}
                  onClick={() => select({ kind: "storyboard", frameId: frame.id })}
                  aria-label={`Storyboard ${frame.label}`}
                  aria-pressed={selectedCard}
                >
                  <span className={`block aspect-video w-full overflow-hidden ${frameBorder}`}>
                    {frame.image ? (
                      <img src={frame.image} alt="" className="block h-full w-full object-cover" />
                    ) : (
                      <span className="storyboard-fpo" aria-hidden />
                    )}
                  </span>
                  <span className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm tracking-[0.22em]">{frame.label}</span>
                    {frame.imageOrigin === "user" ? (
                      <span className="text-[10px] font-medium tracking-[0.14em] text-[#d4cdc2] uppercase">
                        Uploaded
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-snug text-[#cfc6b8]">{frame.intent}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
