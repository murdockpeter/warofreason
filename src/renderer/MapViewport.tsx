import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { originalViewBox, regionalViewBox } from '../domain/regional-map';

type Camera = typeof originalViewBox;
function constrain(camera: Camera, bounds: Camera): Camera {
  return {
    ...camera,
    x: Math.min(
      bounds.x + bounds.width - camera.width,
      Math.max(bounds.x, camera.x),
    ),
    y: Math.min(
      bounds.y + bounds.height - camera.height,
      Math.max(bounds.y, camera.y),
    ),
  };
}
function zoom(
  camera: Camera,
  factor: number,
  bounds: Camera,
  point = { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 },
) {
  const width = Math.max(
    originalViewBox.width / 3,
    Math.min(bounds.width, camera.width / factor),
  );
  const height = (width * originalViewBox.height) / originalViewBox.width;
  return constrain(
    {
      x: point.x - ((point.x - camera.x) * width) / camera.width,
      y: point.y - ((point.y - camera.y) * height) / camera.height,
      width,
      height,
    },
    bounds,
  );
}

/** Camera changes stay local: the large SVG scene and campaign drafts are untouched. */
export function MapViewport({
  expanded,
  focus,
  period,
  label,
  children,
}: {
  expanded: boolean;
  focus?: { x: number; y: number };
  period: boolean;
  label: string;
  children: ReactNode;
}) {
  const bounds = expanded ? regionalViewBox : originalViewBox;
  const [camera, setCamera] = useState<Camera>(originalViewBox);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    camera: Camera;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    const element = svg.current!;
    const wheel = (e: WheelEvent) => {
      const matrix = element.getScreenCTM();
      if (!matrix) return;
      e.preventDefault();
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
        matrix.inverse(),
      );
      setCamera((current) =>
        zoom(current, e.deltaY < 0 ? 1.15 : 1 / 1.15, bounds, point),
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [bounds]);
  return (
    <div
      className="map-camera"
      data-overview={camera.width > originalViewBox.width * 1.5 || undefined}
    >
      <div
        className="map-navigation"
        role="toolbar"
        aria-label="Map navigation"
      >
        <button
          aria-label="Zoom out"
          disabled={camera.width >= bounds.width}
          onClick={() => setCamera((c) => zoom(c, 1 / 1.4, bounds))}
        >
          −
        </button>
        <output aria-label="Map zoom">
          {Math.round((originalViewBox.width / camera.width) * 100)}%
        </output>
        <button
          aria-label="Zoom in"
          disabled={camera.width <= originalViewBox.width / 3}
          onClick={() => setCamera((c) => zoom(c, 1.4, bounds))}
        >
          +
        </button>
        <button onClick={() => setCamera(bounds)}>
          {expanded ? 'Fit region' : 'Fit map'}
        </button>
        <button
          disabled={!focus}
          onClick={() => {
            if (focus)
              setCamera(
                constrain(
                  {
                    ...originalViewBox,
                    x: focus.x - originalViewBox.width / 2,
                    y: focus.y - originalViewBox.height / 2,
                  },
                  bounds,
                ),
              );
          }}
        >
          Centre on selected
        </button>
        {expanded && <span>36 × 24 hexes</span>}
        <small>Drag to pan · scroll to zoom</small>
      </div>
      <svg
        ref={svg}
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
        className={`waterloo-map${period ? ' fontenoy-period-map' : ''}`}
        aria-label={label}
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          drag.current = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            camera,
            moved: false,
          };
          if (e.button === 1) e.preventDefault();
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start || start.pointerId !== e.pointerId || e.buttons === 0)
            return;
          const matrix = svg.current?.getScreenCTM();
          if (!matrix) return;
          if (
            !start.moved &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5
          )
            return;
          start.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setCamera(
            constrain(
              {
                ...start.camera,
                x: start.camera.x - (e.clientX - start.x) / matrix.a,
                y: start.camera.y - (e.clientY - start.y) / matrix.d,
              },
              bounds,
            ),
          );
        }}
        onPointerUp={(e) => {
          if (
            drag.current?.moved &&
            e.currentTarget.hasPointerCapture(e.pointerId)
          )
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onFocusCapture={(e) => {
          const target = e.target as SVGGraphicsElement;
          if (target === svg.current || typeof target.getBBox !== 'function')
            return;
          const box = target.getBBox();
          setCamera((current) =>
            box.x >= current.x &&
            box.y >= current.y &&
            box.x + box.width <= current.x + current.width &&
            box.y + box.height <= current.y + current.height
              ? current
              : constrain(
                  {
                    ...current,
                    x: box.x + box.width / 2 - current.width / 2,
                    y: box.y + box.height / 2 - current.height / 2,
                  },
                  bounds,
                ),
          );
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current = null;
          }
        }}
        onKeyDownCapture={(e) => {
          drag.current = null;
          if (e.target !== e.currentTarget) return;
          const delta = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          }[e.key];
          if (delta) {
            e.preventDefault();
            setCamera((c) =>
              constrain(
                {
                  ...c,
                  x: c.x + (delta[0]! * c.width) / 6,
                  y: c.y + (delta[1]! * c.height) / 6,
                },
                bounds,
              ),
            );
          }
        }}
      >
        {children}
      </svg>
    </div>
  );
}
