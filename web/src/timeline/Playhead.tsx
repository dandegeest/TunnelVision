export function Playhead({ x }: { x: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 h-full w-px bg-[#ece7df]"
      style={{ left: x }}
      aria-hidden="true"
    />
  );
}
