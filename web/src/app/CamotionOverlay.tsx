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

const stroke = {
  stroke: "white",
  strokeWidth: 1,
  vectorEffect: "non-scaling-stroke" as const,
  fill: "none",
};

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
  const boxStyle = fitted
    ? { left: fitted.x, top: fitted.y, width: fitted.width, height: fitted.height }
    : { left: 0, top: 0, width: "100%", height: "100%" };

  return (
    <div className="pointer-events-none absolute" style={boxStyle} data-camotion-overlay="">
      <svg
        className="camotion-overlay absolute inset-0 h-full w-full"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {layers.path ? (
          <g data-overlay-layer="path">
            <line
              x1={path.near[0]}
              y1={path.near[1]}
              x2={path.apex[0]}
              y2={path.apex[1]}
              {...stroke}
              strokeDasharray="5 4"
              opacity={0.85}
            />
            {arrowHead(path.near, path.apex) ? (
              <polygon points={arrowHead(path.near, path.apex)!} fill="white" opacity={0.85} />
            ) : null}
          </g>
        ) : null}
        {showMotion
          ? samples.map((sample, index) => {
              const to: [number, number] = [
                sample.origin[0] + sample.vector[0],
                sample.origin[1] + sample.vector[1],
              ];
              const head = arrowHead(sample.origin, to, 0.016);
              if (!head) {
                return null;
              }
              return (
                <g key={`motion-${index}`} data-overlay-layer="direction">
                  <line
                    x1={sample.origin[0]}
                    y1={sample.origin[1]}
                    x2={to[0]}
                    y2={to[1]}
                    {...stroke}
                    opacity={0.75}
                  />
                  <polygon points={head} fill="white" opacity={0.75} />
                </g>
              );
            })
          : null}
        {layers.points ? (
          <g data-overlay-layer="points">
            <rect
              x={bbox[0]}
              y={bbox[1]}
              width={Math.max(0, bbox[2] - bbox[0])}
              height={Math.max(0, bbox[3] - bbox[1])}
              {...stroke}
              strokeDasharray="3 3"
              opacity={0.55}
            />
            <line x1={vp[0] - 0.018} y1={vp[1]} x2={vp[0] + 0.018} y2={vp[1]} {...stroke} opacity={0.9} />
            <line x1={vp[0]} y1={vp[1] - 0.018} x2={vp[0]} y2={vp[1] + 0.018} {...stroke} opacity={0.9} />
            <circle cx={dest[0]} cy={dest[1]} r={0.012} {...stroke} opacity={0.9} />
          </g>
        ) : null}
      </svg>
      {layers.points ? (
        <>
          <span
            className="absolute -translate-x-1/2 -translate-y-[140%] text-[9px] tracking-[0.16em] text-white/80 uppercase"
            style={{ left: `${vp[0] * 100}%`, top: `${vp[1] * 100}%` }}
          >
            VP
          </span>
          <span
            className="absolute translate-x-[8px] -translate-y-1/2 text-[9px] tracking-[0.16em] text-white/80 uppercase"
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
            aria-label="Plan points"
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
