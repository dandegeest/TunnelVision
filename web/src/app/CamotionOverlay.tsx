import { useEffect, useRef, useState } from "react";
import type { CameraMotionPlanV1 } from "../project/types";
import {
  DEFAULT_OVERLAY_LAYERS,
  containedImageRect,
  motionSamples,
  overlayHasDrawableMotion,
  travelPath,
  type ContainedImageRect,
  type OverlayLayers,
} from "../project/camotion-overlay";

const knockout = {
  vectorEffect: "non-scaling-stroke" as const,
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const haloStroke = {
  ...knockout,
  stroke: "rgba(12, 11, 10, 0.85)",
  strokeWidth: 3,
};

const hairlineStroke = {
  ...knockout,
  stroke: "white",
  strokeWidth: 1,
};

const labelChipClass =
  "pointer-events-none absolute rounded bg-black/70 px-1.5 py-0.5 text-[9px] tracking-[0.16em] text-[#cfc6b8] uppercase";

function arrowHead(from: readonly [number, number], to: readonly [number, number], size = 0.022) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return null;
  }
  const ux = dx / len;
  const uy = dy / len;
  const backX = to[0] - ux * size;
  const backY = to[1] - uy * size;
  const px = -uy * size * 0.42;
  const py = ux * size * 0.42;
  return `${to[0]},${to[1]} ${backX + px},${backY + py} ${backX - px},${backY - py}`;
}

type OverlayPass = "halo" | "hairline";

function HaloLine({
  x1,
  y1,
  x2,
  y2,
  opacity,
  dasharray,
  pass = "both",
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  dasharray?: string;
  pass?: OverlayPass | "both";
}) {
  const dash = dasharray ? { strokeDasharray: dasharray } : {};
  return (
    <>
      {pass !== "hairline" ? (
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...haloStroke} {...dash} opacity={opacity} data-overlay-halo="" />
      ) : null}
      {pass !== "halo" ? (
        <line x1={x1} y1={y1} x2={x2} y2={y2} {...hairlineStroke} {...dash} opacity={opacity} />
      ) : null}
    </>
  );
}

function HaloCircle({
  cx,
  cy,
  r,
  opacity,
  pass = "both",
}: {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
  pass?: OverlayPass | "both";
}) {
  return (
    <>
      {pass !== "hairline" ? (
        <circle cx={cx} cy={cy} r={r} {...haloStroke} opacity={opacity} data-overlay-halo="" />
      ) : null}
      {pass !== "halo" ? <circle cx={cx} cy={cy} r={r} {...hairlineStroke} opacity={opacity} /> : null}
    </>
  );
}

function HaloRect({
  x,
  y,
  width,
  height,
  opacity,
  dasharray,
  pass = "both",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  dasharray?: string;
  pass?: OverlayPass | "both";
}) {
  const dash = dasharray ? { strokeDasharray: dasharray } : {};
  return (
    <>
      {pass !== "hairline" ? (
        <rect x={x} y={y} width={width} height={height} {...haloStroke} {...dash} opacity={opacity} data-overlay-halo="" />
      ) : null}
      {pass !== "halo" ? (
        <rect x={x} y={y} width={width} height={height} {...hairlineStroke} {...dash} opacity={opacity} />
      ) : null}
    </>
  );
}

function HaloPolygon({
  points,
  opacity,
  pass = "both",
}: {
  points: string;
  opacity: number;
  pass?: OverlayPass | "both";
}) {
  return (
    <>
      {pass !== "hairline" ? (
        <polygon
          points={points}
          fill="rgba(12, 11, 10, 0.85)"
          stroke="rgba(12, 11, 10, 0.85)"
          strokeWidth={3}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={opacity}
          data-overlay-halo=""
        />
      ) : null}
      {pass !== "halo" ? <polygon points={points} fill="white" opacity={opacity} /> : null}
    </>
  );
}

export function CamotionPlanOverlay({
  plan,
  layers,
  fitted,
}: {
  plan: CameraMotionPlanV1;
  layers: OverlayLayers;
  fitted: ContainedImageRect | null;
}) {
  const path = travelPath(plan);
  const samples = motionSamples(plan);
  const vp = plan.camera.vanishing_point;
  const dest = plan.destination.point;
  const bbox = plan.destination.bbox;
  const showMotion = layers.direction && overlayHasDrawableMotion(samples);
  const pathHead = arrowHead(path.near, path.apex);
  const motionMarks = showMotion
    ? samples.flatMap((sample, index) => {
        const to: [number, number] = [
          sample.origin[0] + sample.vector[0],
          sample.origin[1] + sample.vector[1],
        ];
        const head = arrowHead(sample.origin, to, 0.016);
        return head ? [{ index, origin: sample.origin, to, head }] : [];
      })
    : [];
  const boxStyle = fitted
    ? { left: fitted.x, top: fitted.y, width: fitted.width, height: fitted.height }
    : { left: 0, top: 0, width: "100%", height: "100%" };

  return (
    <div className="pointer-events-none absolute" style={boxStyle} data-camotion-overlay="" data-vanishing-point={`${vp[0]},${vp[1]}`} data-destination-point={`${dest[0]},${dest[1]}`}>
      <svg
        className="camotion-overlay absolute inset-0 h-full w-full"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {layers.path ? (
          <g data-overlay-layer="path">
            <HaloLine
              x1={path.near[0]}
              y1={path.near[1]}
              x2={path.apex[0]}
              y2={path.apex[1]}
              dasharray="5 4"
              opacity={0.85}
              pass="halo"
            />
            {pathHead ? <HaloPolygon points={pathHead} opacity={0.85} pass="halo" /> : null}
            <HaloLine
              x1={path.near[0]}
              y1={path.near[1]}
              x2={path.apex[0]}
              y2={path.apex[1]}
              dasharray="5 4"
              opacity={0.85}
              pass="hairline"
            />
            {pathHead ? <HaloPolygon points={pathHead} opacity={0.85} pass="hairline" /> : null}
          </g>
        ) : null}
        {showMotion ? (
          <g data-overlay-layer="direction">
            {motionMarks.map((mark) => (
              <g key={`halo-${mark.index}`}>
                <HaloLine
                  x1={mark.origin[0]}
                  y1={mark.origin[1]}
                  x2={mark.to[0]}
                  y2={mark.to[1]}
                  opacity={0.75}
                  pass="halo"
                />
                <HaloPolygon points={mark.head} opacity={0.75} pass="halo" />
              </g>
            ))}
            {motionMarks.map((mark) => (
              <g key={`hairline-${mark.index}`}>
                <HaloLine
                  x1={mark.origin[0]}
                  y1={mark.origin[1]}
                  x2={mark.to[0]}
                  y2={mark.to[1]}
                  opacity={0.75}
                  pass="hairline"
                />
                <HaloPolygon points={mark.head} opacity={0.75} pass="hairline" />
              </g>
            ))}
          </g>
        ) : null}
        {layers.points ? (
          <g data-overlay-layer="points">
            <HaloRect
              x={bbox[0]}
              y={bbox[1]}
              width={Math.max(0, bbox[2] - bbox[0])}
              height={Math.max(0, bbox[3] - bbox[1])}
              dasharray="3 3"
              opacity={0.55}
              pass="halo"
            />
            <HaloLine x1={vp[0] - 0.018} y1={vp[1]} x2={vp[0] + 0.018} y2={vp[1]} opacity={0.9} pass="halo" />
            <HaloLine x1={vp[0]} y1={vp[1] - 0.018} x2={vp[0]} y2={vp[1] + 0.018} opacity={0.9} pass="halo" />
            <HaloCircle cx={dest[0]} cy={dest[1]} r={0.012} opacity={0.9} pass="halo" />
            <HaloRect
              x={bbox[0]}
              y={bbox[1]}
              width={Math.max(0, bbox[2] - bbox[0])}
              height={Math.max(0, bbox[3] - bbox[1])}
              dasharray="3 3"
              opacity={0.55}
              pass="hairline"
            />
            <HaloLine x1={vp[0] - 0.018} y1={vp[1]} x2={vp[0] + 0.018} y2={vp[1]} opacity={0.9} pass="hairline" />
            <HaloLine x1={vp[0]} y1={vp[1] - 0.018} x2={vp[0]} y2={vp[1] + 0.018} opacity={0.9} pass="hairline" />
            <HaloCircle cx={dest[0]} cy={dest[1]} r={0.012} opacity={0.9} pass="hairline" />
          </g>
        ) : null}
      </svg>
      {layers.points ? (
        <>
          <span
            className={`${labelChipClass} -translate-x-1/2 -translate-y-[140%]`}
            data-overlay-label="vp"
            style={{ left: `${vp[0] * 100}%`, top: `${vp[1] * 100}%` }}
          >
            VP
          </span>
          <span
            className={`${labelChipClass} translate-x-[8px] -translate-y-1/2`}
            data-overlay-label="dest"
            style={{ left: `${dest[0] * 100}%`, top: `${dest[1] * 100}%` }}
          >
            D
          </span>
        </>
      ) : null}
    </div>
  );
}

const chipClass = (active: boolean) =>
  `rounded border px-1.5 py-0.5 outline-none ${
    active
      ? "border-[#ece7df] text-[#ece7df]"
      : "border-[#3a342c] text-[#9a8f7e] hover:border-[#7a7266] hover:text-[#cfc6b8]"
  }`;

export function CamotionOverlayToggles({
  overlay,
  layers,
  onOverlayChange,
  onLayersChange,
}: {
  overlay: boolean;
  layers: OverlayLayers;
  onOverlayChange: (overlay: boolean) => void;
  onLayersChange: (layers: OverlayLayers) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]">
      <nav aria-label="Camotion overlay">
        <button
          type="button"
          aria-pressed={overlay}
          aria-label="Toggle overlay"
          className={chipClass(overlay)}
          onClick={() => onOverlayChange(!overlay)}
        >
          Overlay
        </button>
      </nav>
      {overlay ? (
        <nav className="flex items-center gap-1" aria-label="Camotion overlay layers">
          <button
            type="button"
            aria-pressed={layers.path}
            aria-label="Travel path"
            className={chipClass(layers.path)}
            onClick={() => onLayersChange({ ...layers, path: !layers.path })}
          >
            Path
          </button>
          <button
            type="button"
            aria-pressed={layers.direction}
            aria-label="Camotion direction"
            className={chipClass(layers.direction)}
            onClick={() => onLayersChange({ ...layers, direction: !layers.direction })}
          >
            Direction
          </button>
          <button
            type="button"
            aria-pressed={layers.points}
            aria-label="Motion points"
            className={chipClass(layers.points)}
            onClick={() => onLayersChange({ ...layers, points: !layers.points })}
          >
            Points
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function useContainedImageRect(src: string) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [fitted, setFitted] = useState<ContainedImageRect | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) {
      return;
    }
    const update = () => {
      setFitted(
        containedImageRect(img.clientWidth, img.clientHeight, img.naturalWidth, img.naturalHeight),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(img);
    img.addEventListener("load", update);
    return () => {
      observer.disconnect();
      img.removeEventListener("load", update);
    };
  }, [src]);

  return { imgRef, fitted };
}

export function DiagnosticStill({
  src,
  alt,
  plan,
  overlay,
  layers,
  caption,
}: {
  src: string;
  alt: string;
  plan: CameraMotionPlanV1 | null;
  overlay: boolean;
  layers: OverlayLayers;
  caption?: string;
}) {
  const { imgRef, fitted } = useContainedImageRect(src);
  return (
    <figure className="relative h-full w-full">
      <img ref={imgRef} src={src} alt={alt} />
      {overlay && plan ? <CamotionPlanOverlay plan={plan} layers={layers} fitted={fitted} /> : null}
      {caption ? (
        <figcaption className="pointer-events-none absolute bottom-2 left-2 z-[1] rounded bg-black/70 px-2 py-0.5 text-[11px] tracking-[0.14em] text-[#cfc6b8] uppercase">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export { DEFAULT_OVERLAY_LAYERS };
