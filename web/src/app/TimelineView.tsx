import { Inspector } from "./Inspector";
import { Preview } from "./Preview";
import { Timeline } from "../timeline/Timeline";

export function TimelineView() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(320px,44%)] grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
      <div className="min-h-0 overflow-hidden">
        <Preview />
      </div>
      <Inspector />
      <div className="col-span-2 min-h-0 overflow-hidden border-t border-[#2a2620]">
        <Timeline />
      </div>
    </div>
  );
}
